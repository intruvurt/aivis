import StatusUpdate from "../models/StatusUpdate.js";

export const getStatusUpdates = async (req, res, next) => {
  try {
    const statusUpdates = await StatusUpdate.find({})
      .sort({ createdAt: -1 })
      .limit(50);
    res.json({ success: true, statusUpdates });
  } catch (error) {
    next(error);
  }
};

export const createStatusUpdate = async (req, res, next) => {
  try {
    const text = String(req.body.text || "").trim();
    if (!text || text.length < 1 || text.length > 255) {
      return res.status(400).json({
        success: false,
        error: "Status text is required (1–255 chars)",
        statusCode: 400
      });
    }
    const statusUpdate = await StatusUpdate.create({ text });
    res.status(201).json({ success: true, statusUpdate });
  } catch (error) {
    next(error);
  }
};

export const deleteStatusUpdate = async (req, res, next) => {
  try {
    const { id } = req.params;
    const update = await StatusUpdate.findById(id);
    if (!update) {
      return res.status(404).json({ success: false, error: "Status update not found", statusCode: 404 });
    }
    await update.deleteOne();
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
};
