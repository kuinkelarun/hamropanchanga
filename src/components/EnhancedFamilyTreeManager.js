import React, { useState, useEffect } from 'react';
import AddMemberWizard from './AddMemberWizard.js';
import FamilyTreeEngine from '../FamilyTreeEngine.js';
import EnhancedFamilyTreeChart from './EnhancedFamilyTreeChart.js';

/**
 * Integration component that bridges old family tree system with new Phase 2 & 3 features
 * This component maintains backward compatibility while using the new engine
 */
const EnhancedFamilyTreeManager = ({ 
  familyMembers, 
  selfId, 
  onUpdateFamilyMembers, 
  culturalProfile = 'western',
  useEnhancedChart = true 
}) => {
  const [engine, setEngine] = useState(null);
  const [showWizard, setShowWizard] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState(null);
  
  // Phase 3: Auto-Layout System State
  const [layoutMode, setLayoutMode] = useState('auto'); // auto, manual, compact
  const [autoArrange, setAutoArrange] = useState(true);
  const [minimizeCrossings, setMinimizeCrossings] = useState(true);

  // Initialize the family tree engine
  useEffect(() => {
    const initializeEngine = async () => {
      try {
        const newEngine = new FamilyTreeEngine({ 
          culturalProfile,
          compatibilityMode: true 
        });

        const result = await newEngine.initialize({ familyMembers }, selfId);
        
        if (result.success) {
          setEngine(newEngine);
          setIsInitialized(true);
          console.log('Family tree engine initialized successfully');
        } else {
          setError(result.error);
          console.error('Failed to initialize engine:', result.error);
        }
      } catch (err) {
        setError(err.message);
        console.error('Engine initialization error:', err);
      }
    };

    if (familyMembers && selfId) {
      initializeEngine();
    }
  }, [familyMembers, selfId, culturalProfile]);

  // Handle adding new member through wizard
  const handleAddMember = async (memberData, relationshipData) => {
    console.log('EnhancedFamilyTreeManager handleAddMember called', { memberData, relationshipData, engine, isInitialized });
    
    try {
      if (!engine || !isInitialized) {
        console.log('Engine not ready:', { engine, isInitialized });
        throw new Error('Family tree engine not ready');
      }

      // Add member using new engine
      console.log('Adding member to engine...');
      const newMember = engine.addMember(memberData, {
        type: relationshipData.relationshipType,
        strength: relationshipData.strength
      });
      console.log('New member added:', newMember);

      // Connect relationship
      if (relationshipData.targetMemberId && relationshipData.relationshipType) {
        console.log('Adding relationship...');
        engine.addRelationship(
          newMember.id, 
          relationshipData.targetMemberId, 
          relationshipData.relationshipType, 
          relationshipData.strength
        );
        console.log('Relationship added');
      }

      // Convert back to legacy format and update parent component
      console.log('Exporting to legacy format...');
      const updatedLegacyData = engine.exportToLegacyFormat();
      console.log('Legacy data:', updatedLegacyData);
      
  console.log('Calling onUpdateFamilyMembers...');
  const parentResult = await onUpdateFamilyMembers(updatedLegacyData.familyMembers);
      console.log('onUpdateFamilyMembers result:', parentResult);

      // If parent returns a boolean, propagate it. Otherwise treat non-falsey result as success.
      const success = parentResult === false ? false : true;

      if (success) {
        console.log('Update succeeded, closing wizard (defensive)');
        // Ensure wizard closes even if child doesn't call onClose for some reason
        if (showWizard) setShowWizard(false);
      }

      return success;
    } catch (error) {
      console.error('Error adding member:', error);
      setError(error.message);
      return false;
    }
  };

  // Get relationship insights for display
  const getRelationshipInsights = () => {
    if (!engine || !isInitialized) return null;

    try {
      const stats = engine.getFamilyStatistics();
      return {
        totalMembers: stats.memberCount,
        totalRelationships: stats.relationshipCount,
        generations: stats.generationRange,
        relationshipBreakdown: stats.relationshipTypes,
        culturalProfile: stats.culturalProfile
      };
    } catch (error) {
      console.error('Error getting insights:', error);
      return null;
    }
  };

  const insights = getRelationshipInsights();

  return (
    <div className="enhanced-family-tree-manager">
      {/* Engine Status Indicator */}
      <div className="engine-status">
        {isInitialized ? (
          <div className="status-ready">
            <span className="status-indicator ready"></span>
            <span>Smart Engine Ready ({culturalProfile})</span>
            {insights && (
              <span className="stats">
                {insights.totalMembers} members, {insights.totalRelationships} relationships
              </span>
            )}
          </div>
        ) : error ? (
          <div className="status-error">
            <span className="status-indicator error"></span>
            <span>Engine Error: {error}</span>
          </div>
        ) : (
          <div className="status-loading">
            <span className="status-indicator loading"></span>
            <span>Initializing Smart Engine...</span>
          </div>
        )}
      </div>

      {/* Enhanced Add Member Button */}
      <div className="add-member-section">
        <button
          onClick={() => setShowWizard(true)}
          disabled={!isInitialized}
          className="enhanced-add-btn"
        >
          ✨ Add Family Member (Smart Mode)
        </button>
        
        {insights && (
          <div className="family-insights">
            <h4>Family Tree Insights</h4>
            <div className="insight-grid">
              <div className="insight-item">
                <span className="insight-label">Generation Range:</span>
                <span className="insight-value">
                  {insights.generations.min} to {insights.generations.max}
                </span>
              </div>
              <div className="insight-item">
                <span className="insight-label">Cultural Profile:</span>
                <span className="insight-value">{insights.culturalProfile}</span>
              </div>
            </div>
            
            {Object.keys(insights.relationshipBreakdown).length > 0 && (
              <div className="relationship-breakdown">
                <h5>Relationship Types:</h5>
                <div className="breakdown-list">
                  {Object.entries(insights.relationshipBreakdown).map(([type, count]) => (
                    <span key={type} className="breakdown-item">
                      {count} {type}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Smart Add Member Wizard */}
      {showWizard && isInitialized && (
        <AddMemberWizard
          familyTreeEngine={engine}
          selfId={selfId}
          onAddMember={handleAddMember}
          onClose={() => setShowWizard(false)}
          culturalProfile={culturalProfile}
        />
      )}

      {/* Error Display */}
      {error && (
        <div className="error-banner">
          <strong>Error:</strong> {error}
          <button onClick={() => setError(null)} className="dismiss-btn">×</button>
        </div>
      )}

      {/* Phase 3: Layout Controls */}
      {isInitialized && (
        <div className="layout-controls">
          <h4>🔧 Auto-Layout System (Phase 3)</h4>
          <div className="layout-mode-selector">
            <label>Layout Mode:</label>
            <select 
              value={layoutMode} 
              onChange={(e) => setLayoutMode(e.target.value)}
              className="layout-select"
            >
              <option value="auto">Auto Layout</option>
              <option value="compact">Compact View</option>
              <option value="manual">Manual Positioning</option>
            </select>
          </div>
          
          {layoutMode === 'auto' && (
            <div className="auto-layout-options">
              <label>
                <input
                  type="checkbox"
                  checked={autoArrange}
                  onChange={(e) => setAutoArrange(e.target.checked)}
                />
                Auto-arrange on changes
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={minimizeCrossings}
                  onChange={(e) => setMinimizeCrossings(e.target.checked)}
                />
                Minimize connector crossings
              </label>
            </div>
          )}
        </div>
      )}

      {/* Enhanced Family Tree Visualization */}
      {isInitialized && (
        <div className="enhanced-tree-container">
          <h4>Family Tree Visualization</h4>
          <EnhancedFamilyTreeChart
            familyMembers={familyMembers}
            selfId={selfId}
            culturalProfile={culturalProfile}
            layoutMode={layoutMode}
            autoArrange={autoArrange}
            minimizeCrossings={minimizeCrossings}
            onMemberSelect={(memberId) => {
              console.log('Member selected:', memberId);
              // Could trigger member details panel or editing
            }}
            onLayoutChange={(newLayout) => {
              console.log('Layout changed:', newLayout);
              // Could save layout preferences
            }}
          />
        </div>
      )}

      {/* Phase Information */}
      <div className="phase-info">
        <p>
          🚀 <strong>Phase 3 Active:</strong> Auto-Reconfiguration System with intelligent layout optimization, generational hierarchy, and advanced visualization.
        </p>
        <p>
          ✨ Features: Smart relationship inference, cultural adaptability, wizard-based member addition, and automatic layout optimization.
        </p>
      </div>

      <style jsx>{`
        .enhanced-family-tree-manager {
          margin: 20px 0;
          padding: 20px;
          border: 1px solid #e0e0e0;
          border-radius: 12px;
          background: linear-gradient(145deg, #f8f9fa, #ffffff);
          box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
        }

        .engine-status {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 20px;
          padding: 12px;
          border-radius: 8px;
          font-size: 0.9rem;
        }

        .status-ready {
          background-color: #d4edda;
          color: #155724;
          display: flex;
          align-items: center;
          gap: 8px;
          width: 100%;
        }

        .status-error {
          background-color: #f8d7da;
          color: #721c24;
          display: flex;
          align-items: center;
          gap: 8px;
          width: 100%;
        }

        .status-loading {
          background-color: #d1ecf1;
          color: #0c5460;
          display: flex;
          align-items: center;
          gap: 8px;
          width: 100%;
        }

        .status-indicator {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          display: inline-block;
        }

        .status-indicator.ready {
          background-color: #28a745;
        }

        .status-indicator.error {
          background-color: #dc3545;
        }

        .status-indicator.loading {
          background-color: #17a2b8;
          animation: pulse 1.5s infinite;
        }

        .stats {
          font-size: 0.8rem;
          opacity: 0.8;
          margin-left: auto;
        }

        .add-member-section {
          margin-bottom: 20px;
        }

        .enhanced-add-btn {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border: none;
          padding: 15px 30px;
          border-radius: 10px;
          font-weight: 600;
          font-size: 1rem;
          cursor: pointer;
          transition: all 0.3s ease;
          box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3);
        }

        .enhanced-add-btn:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(102, 126, 234, 0.4);
        }

        .enhanced-add-btn:disabled {
          background: #ccc;
          cursor: not-allowed;
          transform: none;
          box-shadow: none;
        }

        .family-insights {
          margin-top: 20px;
          padding: 15px;
          background: #f8f9fa;
          border-radius: 8px;
          border: 1px solid #e9ecef;
        }

        .family-insights h4 {
          margin: 0 0 15px 0;
          color: #495057;
          font-size: 1.1rem;
        }

        .family-insights h5 {
          margin: 15px 0 10px 0;
          color: #6c757d;
          font-size: 0.95rem;
        }

        .insight-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 10px;
          margin-bottom: 15px;
        }

        .insight-item {
          display: flex;
          justify-content: space-between;
          padding: 8px;
          background: white;
          border-radius: 5px;
          border: 1px solid #dee2e6;
        }

        .insight-label {
          font-weight: 600;
          color: #495057;
        }

        .insight-value {
          color: #6c757d;
        }

        .breakdown-list {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .breakdown-item {
          background: white;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 0.85rem;
          border: 1px solid #dee2e6;
          color: #495057;
        }

        .error-banner {
          background-color: #f8d7da;
          color: #721c24;
          padding: 12px;
          border-radius: 6px;
          margin: 15px 0;
          border: 1px solid #f5c6cb;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .dismiss-btn {
          background: none;
          border: none;
          color: #721c24;
          font-size: 1.2rem;
          cursor: pointer;
          padding: 0 5px;
        }

        .phase-info {
          margin-top: 20px;
          padding: 12px;
          background: linear-gradient(135deg, #667eea20, #764ba220);
          border-radius: 8px;
          border: 1px solid #667eea40;
        }

        .phase-info p {
          margin: 0;
          font-size: 0.9rem;
          color: #495057;
        }

        .layout-controls {
          margin: 20px 0;
          padding: 16px;
          background: linear-gradient(135deg, #f8f9fa, #e9ecef);
          border: 2px solid #28a745;
          border-radius: 10px;
          box-shadow: 0 3px 10px rgba(40, 167, 69, 0.15);
        }

        .layout-controls h4 {
          margin: 0 0 15px 0;
          color: #28a745;
          font-weight: 600;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .layout-mode-selector {
          margin-bottom: 15px;
        }

        .layout-mode-selector label {
          display: block;
          margin-bottom: 5px;
          font-weight: 500;
          color: #495057;
        }

        .layout-select {
          width: 100%;
          max-width: 200px;
          padding: 8px 12px;
          border: 2px solid #28a745;
          border-radius: 6px;
          background: white;
          font-size: 14px;
          color: #495057;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .layout-select:focus {
          outline: none;
          border-color: #20c997;
          box-shadow: 0 0 0 3px rgba(40, 167, 69, 0.15);
        }

        .auto-layout-options {
          display: flex;
          flex-direction: column;
          gap: 10px;
          margin-top: 10px;
          padding: 10px;
          background: rgba(40, 167, 69, 0.05);
          border-radius: 6px;
        }

        .auto-layout-options label {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 14px;
          color: #495057;
          cursor: pointer;
        }

        .auto-layout-options input[type="checkbox"] {
          width: 16px;
          height: 16px;
          accent-color: #28a745;
        }

        .enhanced-tree-container {
          margin: 20px 0;
          padding: 16px;
          background: linear-gradient(135deg, #ffffff, #f8f9fa);
          border: 2px solid #007bff;
          border-radius: 10px;
          box-shadow: 0 4px 15px rgba(0, 123, 255, 0.15);
        }

        .enhanced-tree-container h4 {
          margin: 0 0 15px 0;
          color: #007bff;
          font-weight: 600;
          text-align: center;
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
};

export default EnhancedFamilyTreeManager;