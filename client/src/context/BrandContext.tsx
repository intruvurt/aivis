import React, { createContext, useState, useEffect } from "react";
import axios from "axios";
import { API_URL } from "../config";
// Ensure there are no accidental CSS imports here

const BrandContext = createContext();

export const BrandProvider = ({ children }) => {
  const [brand, setBrand] = useState({
    brandName: "AiVis",
    tier: 1,
    logoUrl: null,
    primaryColor: "#4F46E5",
    secondaryColor: "#06B6D4"
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchBrand = async () => {
      try {
        // Extract tenant_id from subdomain or use default
        const hostname = window.location.hostname;
        const subdomain = hostname.split('.')[0];
        const tenant_id = subdomain !== 'localhost' && subdomain !== 'www' ? subdomain : 'default';
        
        const response = await axios.get(`${API_URL.replace(/\/+$/, "")}/api/brand/${tenant_id}`);
        if (response.data.success) {
          setBrand(response.data.brand);
        }
      } catch (error) {
        console.log("Using default brand configuration");
      } finally {
        setLoading(false);
      }
    };

    fetchBrand();
  }, []);

  return (
    <BrandContext.Provider value={{ brand, loading }}>
      {children}
    </BrandContext.Provider>
  );
};

export default BrandContext;
