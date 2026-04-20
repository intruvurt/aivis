// @ts-nocheck
import Brand from "../models/Brand.js";
import { validationResult } from "express-validator";

export const getBrand = async (req, res) => {
  try {
    const { tenant_id } = req.params;
    
    let brand = await Brand.findOne({ tenant_id });
    
    // If brand not found, return default configuration
    if (!brand) {
      return res.json({
        success: true,
        brand: {
          tenant_id: "default",
          brandName: "AiVis",
          branding: {
            logoUrl: null,
            primaryColor: "#4F46E5",
            secondaryColor: "#06B6D4"
          },
          tier: 1
        }
      });
    }
    
    res.json({
      success: true,
      brand
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Something went wrong. Please try again.',
      statusCode: 500
    });
  }
};

export const createBrand = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: errors.array()[0].msg,
        statusCode: 400
      });
    }

    const brand = await Brand.create(req.body);
    
    res.status(201).json({
      success: true,
      data: brand
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        error: "Brand with this tenant_id already exists",
        statusCode: 400
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Something went wrong. Please try again.',
      statusCode: 500
    });
  }
};

export const updateBrand = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: errors.array()[0].msg,
        statusCode: 400
      });
    }

    const { tenant_id } = req.params;
    
    const brand = await Brand.findOneAndUpdate(
      { tenant_id },
      { $set: req.body },
      { new: true, runValidators: true }
    );
    
    if (!brand) {
      return res.status(404).json({
        success: false,
        error: "Brand not found",
        statusCode: 404
      });
    }
    
    res.json({
      success: true,
      data: brand
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Something went wrong. Please try again.',
      statusCode: 500
    });
  }
};

export const deleteBrand = async (req, res) => {
  try {
    const { tenant_id } = req.params;
    
    const brand = await Brand.findOneAndDelete({ tenant_id });
    
    if (!brand) {
      return res.status(404).json({
        success: false,
        error: "Brand not found",
        statusCode: 404
      });
    }
    
    res.json({
      success: true,
      message: "Brand deleted successfully"
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Something went wrong. Please try again.',
      statusCode: 500
    });
  }
};

export const getAllBrands = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    
    const brands = await Brand.find()
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ createdAt: -1 });
    
    const count = await Brand.countDocuments();
    
    res.json({
      success: true,
      data: {
        brands,
        totalPages: Math.ceil(count / limit),
        currentPage: page,
        total: count
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Something went wrong. Please try again.',
      statusCode: 500
    });
  }
};
