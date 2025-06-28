// export async function uploadGraphQLFile({ url, mutation, file, token }) {
//   const operations = JSON.stringify({
//     query: mutation,
//     variables: { file: null }
//   });
//   const map = JSON.stringify({ "0": ["variables.file"] });

//   const formData = new FormData();
//   formData.append("operations", operations);
//   formData.append("map", map);
//   formData.append("0", file, file.name);

//   // --- Fix: Add this extra header ---
//   const headers = { "x-apollo-operation-name": "UploadAvatar" };
//   if (token) headers["Authorization"] = `Bearer ${token}`;

//   const res = await fetch(url, {
//     method: "POST",
//     headers, // These are just extra headers (not overriding content-type for FormData)
//     body: formData,
//   });
//   return res.json();
// }

import React, { useRef } from "react";

export default function AvatarUpload({ token, onUploaded }) {
  const fileInput = useRef();

  // Handle avatar upload
  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("avatar", file);

    // Use your actual backend URL if not on the same domain
    const res = await fetch("localhost:4000/upload/avatar", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}` // IMPORTANT: Only add auth, no content-type header for FormData!
      },
      body: formData,
    });

    const data = await res.json();
    if (data.success) {
      // Call callback with new avatar URL
      onUploaded && onUploaded(data.avatar);
      alert("Avatar updated!");
    } else {
      alert(data.error || "Upload failed");
    }
  };

  return (
    <div>
      <input
        type="file"
        accept="image/*"
        ref={fileInput}
        onChange={handleUpload}
      />
    </div>
  );
}
