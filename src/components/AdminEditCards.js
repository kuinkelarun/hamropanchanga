import React, { useState, useEffect } from 'react';
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, orderBy, query, getDoc, setDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, storage } from '../firebase';
import './AdminEditCards.css';
import { useUserPermissions } from '../hooks/usePermissions';
import { PERMISSIONS } from '../constants/roles';

const AdminEditCards = ({ user, isAdmin, onBack }) => {
    const [cards, setCards] = useState([]);
    const [isEditing, setIsEditing] = useState(false);
    const [currentCard, setCurrentCard] = useState(null);
    const [loading, setLoading] = useState(false);
    const [notification, setNotification] = useState({ show: false, message: '', type: '' });
    const [block1Visible, setBlock1Visible] = useState(true);
    
    // Check permissions
    const { hasPermission } = useUserPermissions(user);
    const canManageHomeCards = hasPermission(PERMISSIONS.MANAGE_HOME_CARDS);
    
    // Form state
    const [formData, setFormData] = useState({
        icon: '',
        title: '',
        description: '',
        action: '',
        link: '',
        textPosition: 'center',
        imageUrl: '',
        imageName: '',
        published: false,
        order: 0
    });
    
    const [imageFile, setImageFile] = useState(null);
    const [imagePreview, setImagePreview] = useState('');
    const [fitToCard, setFitToCard] = useState(true);

    // Fetch cards from Firestore
    useEffect(() => {
        if (!user || !canManageHomeCards) return;
        
        const q = query(collection(db, 'homeCards'), orderBy('order', 'asc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const cardsData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setCards(cardsData);
        }, (error) => {
            console.error('Error fetching cards:', error);
            showNotification('Error loading cards', 'error');
        });

        return () => unsubscribe();
    }, [user, canManageHomeCards]);

    // Fetch Block 1 visibility setting
    useEffect(() => {
        if (!user || !isAdmin) return;
        
        const fetchBlock1Visibility = async () => {
            try {
                const settingsDoc = await getDoc(doc(db, 'siteSettings', 'block1'));
                if (settingsDoc.exists()) {
                    setBlock1Visible(settingsDoc.data().visible !== false); // Default to true
                }
            } catch (error) {
                console.error('Error fetching Block 1 visibility:', error);
            }
        };
        
        fetchBlock1Visibility();
    }, [user, isAdmin]);

    // Toggle Block 1 visibility
    const toggleBlock1Visibility = async () => {
        try {
            const newVisibility = !block1Visible;
            await setDoc(doc(db, 'siteSettings', 'block1'), {
                visible: newVisibility,
                updatedAt: new Date().toISOString(),
                updatedBy: user.uid
            });
            setBlock1Visible(newVisibility);
            showNotification(
                `Block 1 is now ${newVisibility ? 'visible' : 'hidden'}`,
                'success'
            );
        } catch (error) {
            console.error('Error toggling Block 1 visibility:', error);
            showNotification('Error updating visibility', 'error');
        }
    };

    const showNotification = (message, type = 'success') => {
        setNotification({ show: true, message, type });
        setTimeout(() => {
            setNotification({ show: false, message: '', type: '' });
        }, 3000);
    };

    const handleAddNew = () => {
        setCurrentCard(null);
        setFormData({
            icon: '📰',
            title: '',
            description: '',
            action: 'Learn More',
            link: '',
            textPosition: 'center',
            imageUrl: '',
            imageName: '',
            published: false,
            order: cards.length
        });
        setImageFile(null);
        setImagePreview('');
        setIsEditing(true);
    };

    const handleEdit = (card) => {
        setCurrentCard(card);
        setFormData(card);
        setImagePreview(card.imageUrl || '');
        setImageFile(null);
        setIsEditing(true);
    };

    const handleDelete = async (card) => {
        if (!window.confirm(`Delete card "${card.title}"? This action cannot be undone.`)) return;
        
        setLoading(true);
        try {
            // Delete image from storage if exists
            if (card.imageName) {
                const imageRef = ref(storage, `homeCards/${card.imageName}`);
                await deleteObject(imageRef).catch(() => {});
            }
            
            // Delete document
            await deleteDoc(doc(db, 'homeCards', card.id));
            showNotification('Card deleted successfully', 'success');
        } catch (error) {
            console.error('Error deleting card:', error);
            showNotification('Error deleting card', 'error');
        }
        setLoading(false);
    };

    const handleImageChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            if (file.size > 5 * 1024 * 1024) {
                showNotification('Image size should be less than 5MB', 'error');
                return;
            }
            setImageFile(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setImagePreview(reader.result);
            };
            reader.readAsDataURL(file);
        }
    };

    const uploadImage = async () => {
        if (!imageFile) return formData.imageUrl;
        
        const timestamp = Date.now();
        const fileName = `${timestamp}_${imageFile.name}`;
        const storageRef = ref(storage, `homeCards/${fileName}`);
        
        await uploadBytes(storageRef, imageFile);
        const downloadURL = await getDownloadURL(storageRef);
        
        return { imageUrl: downloadURL, imageName: fileName };
    };

    const handleSave = async (publish = false) => {
        // Validation - require at least title OR description
        if (!formData.title.trim() && !formData.description.trim()) {
            showNotification('Either Title or Description is required', 'error');
            return;
        }
        if (formData.link && !isValidUrl(formData.link)) {
            showNotification('Please enter a valid URL', 'error');
            return;
        }

        setLoading(true);
        try {
            let imageData = { imageUrl: formData.imageUrl, imageName: formData.imageName };
            
            // Upload new image if selected
            if (imageFile) {
                // Delete old image if exists
                if (formData.imageName) {
                    const oldImageRef = ref(storage, `homeCards/${formData.imageName}`);
                    await deleteObject(oldImageRef).catch(() => {});
                }
                imageData = await uploadImage();
            }

            const cardData = {
                ...formData,
                ...imageData,
                published: publish || formData.published,
                updatedAt: new Date().toISOString()
            };

            if (currentCard) {
                // Update existing card
                await updateDoc(doc(db, 'homeCards', currentCard.id), cardData);
                showNotification(`Card ${publish ? 'published' : 'saved'} successfully`, 'success');
            } else {
                // Add new card
                await addDoc(collection(db, 'homeCards'), {
                    ...cardData,
                    createdAt: new Date().toISOString()
                });
                showNotification(`Card ${publish ? 'published' : 'created'} successfully`, 'success');
            }

            setIsEditing(false);
            setImageFile(null);
            setImagePreview('');
        } catch (error) {
            console.error('Error saving card:', error);
            showNotification('Error saving card', 'error');
        }
        setLoading(false);
    };

    const isValidUrl = (string) => {
        try {
            new URL(string);
            return true;
        } catch (_) {
            return false;
        }
    };

    const handleTogglePublish = async (card) => {
        setLoading(true);
        try {
            await updateDoc(doc(db, 'homeCards', card.id), {
                published: !card.published,
                updatedAt: new Date().toISOString()
            });
            showNotification(`Card ${!card.published ? 'published' : 'unpublished'}`, 'success');
        } catch (error) {
            console.error('Error toggling publish:', error);
            showNotification('Error updating card', 'error');
        }
        setLoading(false);
    };

    if (!user || !canManageHomeCards) {
        return (
            <div className="admin-access-denied">
                <h2>Access Denied</h2>
                <p>You must have permission to manage home cards to access this page.</p>
                <button onClick={onBack}>Go Back</button>
            </div>
        );
    }

    return (
        <div className="admin-edit-cards">
            {/* Notification Toast */}
            {notification.show && (
                <div className={`notification-toast ${notification.type}`}>
                    {notification.message}
                </div>
            )}

            {/* Header */}
            <div className="admin-header">
                <div className="admin-header-left">
                    <button onClick={onBack} className="admin-back-btn">← Back</button>
                    <h1>Manage Home Cards</h1>
                </div>
                <div className="admin-header-right">
                        {isAdmin && (
                        <div className="block1-visibility-toggle">
                            <label className="toggle-label">
                                <span>Show Block 1 on Homepage:</span>
                                <button
                                    onClick={toggleBlock1Visibility}
                                    className={`toggle-switch ${block1Visible ? 'active' : ''}`}
                                >
                                    <span className="toggle-slider"></span>
                                </button>
                                <span className="toggle-status">{block1Visible ? 'Visible' : 'Hidden'}</span>
                            </label>
                        </div>
                        )}
                    <button onClick={handleAddNew} className="admin-add-btn">
                        + Add New Card
                    </button>
                </div>
            </div>

            {/* Cards Grid */}
            <div className="admin-cards-grid">
                {cards.map(card => (
                    <div key={card.id} className={`admin-card-item ${!card.published ? 'draft' : ''}`}>
                        <div className="admin-card-preview">
                            {card.imageUrl ? (
                                <img src={card.imageUrl} alt={card.title} className="admin-card-image" />
                            ) : (
                                <div className="admin-card-icon">{card.icon}</div>
                            )}
                            <div className={`admin-card-content text-${card.textPosition}`}>
                                <h3>{card.title}</h3>
                                <p>{card.description}</p>
                            </div>
                        </div>
                        <div className="admin-card-actions">
                            <span className={`admin-card-status ${card.published ? 'published' : 'draft'}`}>
                                {card.published ? '✓ Published' : '○ Draft'}
                            </span>
                            <div className="admin-card-buttons">
                                <button onClick={() => handleEdit(card)} className="admin-btn-edit">
                                    Edit
                                </button>
                                <button 
                                    onClick={() => handleTogglePublish(card)} 
                                    className="admin-btn-toggle"
                                >
                                    {card.published ? 'Unpublish' : 'Publish'}
                                </button>
                                <button onClick={() => handleDelete(card)} className="admin-btn-delete">
                                    Delete
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
                
                {cards.length === 0 && (
                    <div className="admin-empty-state">
                        <p>No cards yet. Click "Add New Card" to create one.</p>
                    </div>
                )}
            </div>

            {/* Edit Modal */}
            {isEditing && (
                <div className="admin-modal-backdrop" onClick={() => !loading && setIsEditing(false)}>
                    <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="admin-modal-header">
                            <h2>{currentCard ? 'Edit Card' : 'Add New Card'}</h2>
                            <button onClick={() => setIsEditing(false)} className="admin-modal-close">×</button>
                        </div>

                        <div className="admin-modal-body">
                            {/* Icon Field */}
                            <div className="admin-form-group">
                                <label>Icon (Emoji)</label>
                                <input
                                    type="text"
                                    value={formData.icon}
                                    onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                                    placeholder="📰"
                                    maxLength={2}
                                />
                            </div>

                            {/* Image Upload */}
                            <div className="admin-form-group">
                                <label>Card Image (Optional)</label>
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={handleImageChange}
                                    className="admin-file-input"
                                />
                                <label className="admin-checkbox">
                                    <input
                                        type="checkbox"
                                        checked={fitToCard}
                                        onChange={(e) => setFitToCard(e.target.checked)}
                                    />
                                    Fit to card
                                </label>
                                {imagePreview && (
                                    <div className="admin-image-preview">
                                        <img src={imagePreview} alt="Preview" style={{ objectFit: fitToCard ? 'cover' : 'contain' }} />
                                    </div>
                                )}
                            </div>

                            {/* Title */}
                            <div className="admin-form-group">
                                <label>Title (at least one required)</label>
                                <input
                                    type="text"
                                    value={formData.title}
                                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                    placeholder="Card Title"
                                />
                            </div>

                            {/* Description */}
                            <div className="admin-form-group">
                                <label>Description (at least one required)</label>
                                <textarea
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    placeholder="Card description..."
                                    rows={4}
                                />
                            </div>

                            {/* Text Position */}
                            <div className="admin-form-group">
                                <label>Text Position</label>
                                <select
                                    value={formData.textPosition}
                                    onChange={(e) => setFormData({ ...formData, textPosition: e.target.value })}
                                >
                                    <option value="top">Top</option>
                                    <option value="center">Center</option>
                                    <option value="bottom">Bottom</option>
                                </select>
                            </div>

                            {/* Button Text */}
                            <div className="admin-form-group">
                                <label>Button Text</label>
                                <input
                                    type="text"
                                    value={formData.action}
                                    onChange={(e) => setFormData({ ...formData, action: e.target.value })}
                                    placeholder="Learn More"
                                />
                            </div>

                            {/* Link */}
                            <div className="admin-form-group">
                                <label>Link URL (Optional)</label>
                                <input
                                    type="url"
                                    value={formData.link}
                                    onChange={(e) => setFormData({ ...formData, link: e.target.value })}
                                    placeholder="https://example.com"
                                />
                            </div>

                            {/* Order */}
                            <div className="admin-form-group">
                                <label>Display Order</label>
                                <input
                                    type="number"
                                    value={formData.order}
                                    onChange={(e) => setFormData({ ...formData, order: parseInt(e.target.value) })}
                                    min={0}
                                />
                            </div>
                        </div>

                        <div className="admin-modal-footer">
                            <button onClick={() => setIsEditing(false)} className="admin-btn-cancel" disabled={loading}>
                                Cancel
                            </button>
                            <button onClick={() => handleSave(false)} className="admin-btn-save" disabled={loading}>
                                {loading ? 'Saving...' : 'Save as Draft'}
                            </button>
                            <button onClick={() => handleSave(true)} className="admin-btn-publish" disabled={loading}>
                                {loading ? 'Publishing...' : 'Save & Publish'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {loading && (
                <div className="admin-loading-overlay">
                    <div className="admin-spinner"></div>
                </div>
            )}
        </div>
    );
};

export default AdminEditCards;
