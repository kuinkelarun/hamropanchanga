import React, { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import TithiCalculator from './TithiCalculator';
import './Block1.css';

const BlockTithi = () => {
  const [visible, setVisible] = useState(null);

  useEffect(() => {
    const fetchVisibility = async () => {
      try {
        const settingsDoc = await getDoc(doc(db, 'siteSettings', 'blockTithi'));
        if (settingsDoc.exists()) {
          setVisible(settingsDoc.data().visible !== false);
        } else {
          setVisible(true);
        }
      } catch (error) {
        console.error('Error fetching BlockTithi visibility:', error);
        setVisible(true);
      }
    };
    fetchVisibility();
  }, []);

  if (visible !== true) return null;

  return (
    <section className="block1-container">
      <div className="block1-header">
        <h2 className="block1-title">Tithi Calculator</h2>
        <p className="block1-subtitle">Quickly compute tithi from Sun & Moon longitudes</p>
      </div>
      <div style={{ padding: '12px', display: 'flex', justifyContent: 'center' }}>
        <TithiCalculator />
      </div>
    </section>
  );
};

export default BlockTithi;
