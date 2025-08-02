import React, { useRef } from "react";

export default function AvatarUpload({ token, onUploaded }) {
  const fileInput = useRef();

  // Best practice: Always get BACKEND_URL from env, strip any trailing slashes.
  const rawBackendUrl = process.env.BACKEND_URL || "http://localhost:4000";
  const BACKEND_URL = rawBackendUrl.replace(/\/+$/, ""); // No trailing slash

  // Handle avatar upload
  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("avatar", file);

    // Construct correct upload endpoint
    const uploadUrl = `${BACKEND_URL}/upload/avatar`;

    try {
      const res = await fetch(uploadUrl, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`
          // Do NOT set Content-Type! Let browser set it for FormData.
        },
        body: formData,
      });

      const data = await res.json();
      if (data.success) {
        // Callback with new avatar path (usually /uploads/avatars/xyz.png)
        onUploaded && onUploaded(data.avatar);
        alert("Avatar updated!");
      } else {
        alert(data.error || "Upload failed");
      }
    } catch (err) {
      alert("Network error while uploading avatar.");
    }
  };

  return (
    <div>
      <input
        type="file"
        accept="image/png, image/jpeg, image/webp"
        ref={fileInput}
        onChange={handleUpload}
      />
    </div>
  );
}
