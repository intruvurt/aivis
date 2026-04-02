import { validationResult } from "express-validator";
import User from "../models/User.js";

export const updateStatus = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: errors.array()[0].msg,
        statusCode: 400
      });
    }

    const { status } = req.body;
    const userId = req.user.id;

    // Update user status in database
    const user = await User.findByIdAndUpdate(
      userId,
      { status },
      { new: true, runValidators: true }
    ).select("-password");

    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found",
        statusCode: 404
      });
    }

    return res.json({
      success: true,
      message: "Status updated successfully",
      data: {
        status: user.status
      }
    });
  } catch (err) {
    console.error("Status update error:", err);
    return res.status(500).json({
      success: false,
      error: "Server error",
      statusCode: 500
    });
  }
};

export const getStatus = async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await User.findById(userId).select("status");

    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found",
        statusCode: 404
      });
    }

    return res.json({
      success: true,
      data: {
        status: user.status || "active"
      }
    });
  } catch (err) {
    console.error("Get status error:", err);
    return res.status(500).json({
      success: false,
      error: "Server error",
      statusCode: 500
    });
  }
};
