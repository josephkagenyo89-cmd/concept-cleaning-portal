/**
 * PHOTO UPLOAD API ROUTE
 * POST /api/booking-agent/upload-photo
 */

import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface PhotoUploadRequest {
  requestId: string;
  requestItemId?: string;
  category: "overall_area" | "problem_area" | "stain" | "damage" | "pest_evidence" | "measurement" | "other";
  fileName: string;
  fileData: string;
  mimeType: string;
  userId: string;
}

interface PhotoUploadResponse {
  status: "success" | "error";
  photoId?: string;
  storagePath?: string;
  fileName?: string;
  fileSize?: number;
  message?: string;
}

const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
];

const MAX_FILE_SIZE = 10 * 1024 * 1024;

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader) {
      return NextResponse.json(
        { status: "error", message: "Unauthorized" },
        { status: 401 }
      );
    }

    const body: PhotoUploadRequest = await request.json();

    if (!body.requestId || !body.category || !body.fileData || !body.mimeType) {
      return NextResponse.json(
        { status: "error", message: "Missing required fields" },
        { status: 400 }
      );
    }

    if (!ALLOWED_MIME_TYPES.includes(body.mimeType)) {
      return NextResponse.json(
        { status: "error", message: "Invalid file type. Only images allowed." },
        { status: 400 }
      );
    }

    const validCategories = [
      "overall_area",
      "problem_area",
      "stain",
      "damage",
      "pest_evidence",
      "measurement",
      "other",
    ];
    if (!validCategories.includes(body.category)) {
      return NextResponse.json(
        { status: "error", message: "Invalid photo category" },
        { status: 400 }
      );
    }

    // Verify customer owns request
    const { data: requestRecord, error: requestError } = await supabase
      .from("booking_engine_requests")
      .select("id, customer_user_id, status")
      .eq("id", body.requestId)
      .single();

    if (requestError || !requestRecord) {
      return NextResponse.json(
        { status: "error", message: "Request not found" },
        { status: 404 }
      );
    }

    if (requestRecord.customer_user_id !== body.userId) {
      return NextResponse.json(
        { status: "error", message: "You do not own this request" },
        { status: 403 }
      );
    }

    if (requestRecord.status !== "draft") {
      return NextResponse.json(
        { status: "error", message: "Cannot add photos to non-draft requests" },
        { status: 400 }
      );
    }

    // Convert base64 to buffer
    const base64Data = body.fileData.includes(",")
      ? body.fileData.split(",")[1]
      : body.fileData;

    const fileBuffer = Buffer.from(base64Data, "base64");

    if (fileBuffer.length > MAX_FILE_SIZE) {
      return NextResponse.json(
        { status: "error", message: "File too large. Maximum 10 MB." },
        { status: 400 }
      );
    }

    // Upload to Supabase storage
    const timestamp = Date.now();
    const fileExtension = body.fileName.split(".").pop() || "jpg";
    const storagePath = `${body.requestId}/${timestamp}-${body.category}.${fileExtension}`;

    const { error: uploadError } = await supabase.storage
      .from("booking-engine-photos")
      .upload(storagePath, fileBuffer, {
        contentType: body.mimeType,
        upsert: false,
      });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      return NextResponse.json(
        { status: "error", message: "Failed to upload file" },
        { status: 500 }
      );
    }

    // Store metadata in database
    const { data: photoRecord, error: dbError } = await supabase
      .from("booking_engine_request_photos")
      .insert({
        request_id: body.requestId,
        request_item_id: body.requestItemId || null,
        storage_path: storagePath,
        photo_category: body.category,
        original_filename: body.fileName,
        mime_type: body.mimeType,
        file_size_bytes: fileBuffer.length,
        width: null,
        height: null,
        display_order: 0,
      })
      .select()
      .single();

    if (dbError) {
      console.error("Database error:", dbError);
      await supabase.storage.from("booking-engine-photos").remove([storagePath]);
      return NextResponse.json(
        { status: "error", message: "Failed to save photo metadata" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      status: "success",
      photoId: photoRecord.id,
      storagePath: storagePath,
      fileName: body.fileName,
      fileSize: fileBuffer.length,
      message: "Photo uploaded successfully",
    } as PhotoUploadResponse);
  } catch (error) {
    console.error("Photo upload error:", error);
    return NextResponse.json(
      {
        status: "error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
