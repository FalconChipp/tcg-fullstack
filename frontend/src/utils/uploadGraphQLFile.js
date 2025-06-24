export async function uploadGraphQLFile({ url, mutation, file, token }) {
  const operations = JSON.stringify({
    query: mutation,
    variables: { file: null }
  });
  const map = JSON.stringify({ "0": ["variables.file"] });

  const formData = new FormData();
  formData.append("operations", operations);
  formData.append("map", map);
  formData.append("0", file, file.name);

  // --- Fix: Add this extra header ---
  const headers = { "x-apollo-operation-name": "UploadAvatar" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(url, {
    method: "POST",
    headers, // These are just extra headers (not overriding content-type for FormData)
    body: formData,
  });
  return res.json();
}