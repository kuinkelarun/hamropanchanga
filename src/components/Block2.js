import React, { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import TithiCalculator from './TithiCalculator';
import './Block2.css';

const Block2 = () => {
  const [visible, setVisible] = useState(null);

  useEffect(() => {
    const fetchVisibility = async () => {
      try {
        const settingsDoc = await getDoc(doc(db, 'siteSettings', 'block2'));
        if (settingsDoc.exists()) {
          setVisible(settingsDoc.data().visible !== false);
        } else {
          setVisible(true);
        }
      } catch (error) {
        console.error('Error fetching Block2 visibility:', error);
        setVisible(true);
      }
    };
    fetchVisibility();
  }, []);

  if (visible !== true) return null;

  return (
    <div className="block2-inline">
      <div className="block2-header">
        <h3 className="block2-title">Tithi Calculator</h3>
        <p className="block2-subtitle">Compute tithi from Sun & Moon longitudes</p>
      </div>
      <div className="block2-content">
        <TithiCalculator />
      </div>
    </div>
  );
};

export default Block2;
