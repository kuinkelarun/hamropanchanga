import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, collection, getDocs, updateDoc, addDoc, setDoc, writeBatch } from 'firebase/firestore';
import { db } from '../../firebase';
import TreeBoard from './TreeBoard';
import './styles/TreeBuilder.css';

export default function TreeBuilderPage({ user }) {
  const { customerId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [customerName, setCustomerName] = useState('');
  const [sidebarMembers, setSidebarMembers] = useState([]);

  // Load Tree Data
  useEffect(() => {
    async function loadTreeData() {
      if (!customerId) return;
      setLoading(true);
      try {
        // 1. Get Customer Info (and legacy embedded data if present)
        const customerRef = doc(db, 'customers', customerId);
        const customerDoc = await getDoc(customerRef);
        let customerData = null;
        if (customerDoc.exists()) {
          customerData = customerDoc.data();
          setCustomerName(customerData.name);
        }

        // 2. Get Family Members (Nodes) from subcollection
        const membersRef = collection(db, 'customers', customerId, 'familyMembers');
        let snapshot = await getDocs(membersRef);

        // If there is legacy embedded familyMembers data on the customer doc but
        // no subcollection yet, migrate it into the subcollection so the
        // builder can work with existing customers.
        if (snapshot.empty && customerData && customerData.familyMembers && typeof customerData.familyMembers === 'object') {
          try {
            const batch = writeBatch(db);
            const legacyMembers = customerData.familyMembers;

            Object.keys(legacyMembers).forEach((memberId) => {
              const legacy = legacyMembers[memberId];
              if (!legacy) return;

              const memberRef = doc(db, 'customers', customerId, 'familyMembers', memberId);
              batch.set(memberRef, {
                name: legacy.name || '',
                gender: legacy.gender || 'unknown',
                relation: legacy.relation || '',
                // Existing customers won't have canvas positions yet; they'll
                // start in the sidebar until the user drags them onto canvas.
                position: legacy.position || null,
                // Relationships can be enhanced later from parentIds/spouseIds.
                relationships: [],
                createdAt: legacy.createdAt || new Date().toISOString()
              });
            });

            await batch.commit();
            snapshot = await getDocs(membersRef);
          } catch (migrateErr) {
            console.error('Error migrating legacy familyMembers to subcollection:', migrateErr);
          }
        }
        
        const loadedNodes = [];
        const loadedEdges = [];
        const allMembers = [];

        snapshot.forEach(doc => {
          const data = doc.data();
          allMembers.push({ id: doc.id, ...data });

          // Only add to canvas if it has a position
          if (data.position && typeof data.position.x === 'number') {
            loadedNodes.push({
              id: doc.id,
              type: 'familyNode',
              position: data.position,
              data: { 
                label: data.name,
                gender: data.gender,
                connected: (data.relationships && data.relationships.length > 0)
              }
            });
          }

          // Transform Relationships to ReactFlow Edges
          if (data.relationships && Array.isArray(data.relationships)) {
            data.relationships.forEach((rel, index) => {
              loadedEdges.push({
                id: `e-${doc.id}-${rel.relativeId}-${index}`,
                source: doc.id,
                target: rel.relativeId,
                label: rel.type,
                type: 'smoothstep'
              });
            });
          }
        });

        setNodes(loadedNodes);
        setEdges(loadedEdges);
        
        // Filter members not on canvas for sidebar
        const onCanvasIds = new Set(loadedNodes.map(n => n.id));
        setSidebarMembers(allMembers.filter(m => !onCanvasIds.has(m.id)));

      } catch (error) {
        console.error("Error loading tree:", error);
      } finally {
        setLoading(false);
      }
    }

    loadTreeData();
  }, [customerId]);

  // Handle Drag Start from Sidebar
  const onDragStart = (event, member) => {
    event.dataTransfer.setData('application/reactflow', JSON.stringify(member));
    event.dataTransfer.effectAllowed = 'move';
  };

  // Handle Drop on Canvas
  const onDrop = useCallback(async (event) => {
    event.preventDefault();

    const reactFlowBounds = document.querySelector('.react-flow').getBoundingClientRect();
    const memberData = JSON.parse(event.dataTransfer.getData('application/reactflow'));
    
    // Calculate position relative to canvas
    const position = {
      x: event.clientX - reactFlowBounds.left,
      y: event.clientY - reactFlowBounds.top,
    };

    const newNode = {
      id: memberData.id,
      type: 'familyNode',
      position,
      data: { label: memberData.name, gender: memberData.gender }
    };

    setNodes((nds) => [...nds, newNode]);
    
    // Remove from sidebar
    setSidebarMembers((prev) => prev.filter(m => m.id !== memberData.id));

    // Save position to Firestore
    try {
      const memberRef = doc(db, 'customers', customerId, 'familyMembers', memberData.id);
      await updateDoc(memberRef, { position });
    } catch (error) {
      console.error('Error saving dropped node position:', error);
    }
  }, [customerId]);

  const onDragOver = useCallback((event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  // Save Node Position
  const onNodeDragStop = useCallback(async (event, node) => {
    try {
      const memberRef = doc(db, 'customers', customerId, 'familyMembers', node.id);
      await updateDoc(memberRef, {
        position: node.position
      });
      console.log('Position saved for', node.id);
    } catch (error) {
      console.error('Error saving position:', error);
    }
  }, [customerId]);

  // Handle New Connection
  const onConnect = useCallback(async (params) => {
    // Optimistic UI update
    const newEdge = { ...params, id: `e-${params.source}-${params.target}`, type: 'smoothstep' };
    setEdges((eds) => [...eds, newEdge]);

    // Save to Firestore (Bi-directional)
    try {
      // 1. Source -> Target
      const sourceRef = doc(db, 'customers', customerId, 'familyMembers', params.source);
      const sourceDoc = await getDoc(sourceRef);
      const sourceRels = sourceDoc.data().relationships || [];
      
      // Check if exists
      if (!sourceRels.find(r => r.relativeId === params.target)) {
        await updateDoc(sourceRef, {
          relationships: [...sourceRels, { relativeId: params.target, type: 'custom' }] // Default type
        });
      }

      // 2. Target -> Source
      const targetRef = doc(db, 'customers', customerId, 'familyMembers', params.target);
      const targetDoc = await getDoc(targetRef);
      const targetRels = targetDoc.data().relationships || [];

      if (!targetRels.find(r => r.relativeId === params.source)) {
        await updateDoc(targetRef, {
          relationships: [...targetRels, { relativeId: params.source, type: 'custom' }]
        });
      }

    } catch (error) {
      console.error('Error saving connection:', error);
    }
  }, [customerId]);

  // Handle Add New Member
  const handleAddNewMember = async () => {
    const name = prompt("Enter member name:");
    if (!name) return;

    try {
      const newMember = {
        name,
        gender: 'unknown',
        relationships: [],
        createdAt: new Date().toISOString()
      };
      
      const docRef = await addDoc(collection(db, 'customers', customerId, 'familyMembers'), newMember);
      
      // Add to sidebar
      setSidebarMembers(prev => [...prev, { id: docRef.id, ...newMember }]);
    } catch (error) {
      console.error("Error adding member:", error);
      alert("Failed to add member");
    }
  };

  if (loading) {
    return <div className="builder-loading">Loading Family Tree...</div>;
  }

  return (
    <div className="tree-builder-container">
      <div className="tree-builder-sidebar">
        <div className="tree-builder-header">
          <h2>{customerName || 'Family Tree'}</h2>
          <button className="control-btn" onClick={() => navigate('/')}>Exit</button>
        </div>
        <div className="sidebar-content">
          <p className="text-sm text-gray-500 mb-4">Drag members to canvas or connect nodes to build relationships.</p>
          
          {sidebarMembers.length === 0 ? (
            <div className="text-sm text-gray-400 italic p-4 text-center">
              All members are on the canvas.
            </div>
          ) : (
            sidebarMembers.map(member => (
              <div 
                key={member.id}
                className="draggable-member"
                draggable
                onDragStart={(event) => onDragStart(event, member)}
              >
                <div className="member-avatar">
                  {member.name.charAt(0).toUpperCase()}
                </div>
                <div className="member-info">
                  <div className="member-name">{member.name}</div>
                  <div className="member-role">{member.relation || 'Member'}</div>
                </div>
              </div>
            ))
          )}
          
          <div className="mt-4 pt-4 border-t border-gray-200">
             <button 
               className="w-full py-2 px-4 bg-blue-50 text-blue-600 rounded-lg text-sm font-medium hover:bg-blue-100 transition-colors"
               onClick={handleAddNewMember}
             >
               + Add New Member
             </button>
          </div>
        </div>
      </div>
      
      <div className="tree-builder-canvas" onDrop={onDrop} onDragOver={onDragOver}>
        <TreeBoard 
          nodes={nodes}
          edges={edges}
          setNodes={setNodes}
          setEdges={setEdges}
          onNodeDragStop={onNodeDragStop}
          onConnect={onConnect}
        />
      </div>
    </div>
  );
}
