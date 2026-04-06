import type { Request, Response } from "express";
import axios from "axios";
import FormData from "form-data";

export const detectDiseaseHandler = async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const formData = new FormData();
    formData.append("file", req.file.buffer, req.file.originalname);

    const response = await axios.post(
      "http://localhost:8000/detect-disease",
      formData,
      {
        headers: formData.getHeaders()
      }
    );

    res.json(response.data);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Disease detection failed" });
  }
};