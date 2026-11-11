import { apiRequest, getStoredToken } from "./session";

const MAX_BYTES = 25 * 1024 * 1024;

function uploadDirect(
  url: string,
  file: File,
  onProgress?: (percent: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
    xhr.upload.onprogress = event => {
      if (event.lengthComputable) onProgress?.(Math.round((event.loaded / event.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`File upload failed (${xhr.status})`));
    };
    xhr.onerror = () => reject(new Error("Could not connect to the upload service"));
    xhr.send(file);
  });
}

function uploadViaServer(
  file: File,
  onProgress?: (percent: number) => void
): Promise<string> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/files/upload");
    xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
    xhr.setRequestHeader("x-midad-client", "1");
    xhr.setRequestHeader("x-file-name", encodeURIComponent(file.name));
    const token = getStoredToken();
    if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.upload.onprogress = event => {
      if (event.lengthComputable) onProgress?.(Math.round((event.loaded / event.total) * 100));
    };
    xhr.onload = () => {
      try {
        const data = JSON.parse(xhr.responseText) as { key?: string; error?: string };
        if (xhr.status >= 200 && xhr.status < 300 && data.key) resolve(data.key);
        else reject(new Error(data.error || "Could not upload the file"));
      } catch {
        reject(new Error("Invalid upload response"));
      }
    };
    xhr.onerror = () => reject(new Error("Could not upload the file"));
    xhr.send(file);
  });
}

export async function uploadHomeworkFile(
  file: File,
  onProgress?: (percent: number) => void
): Promise<{ key: string; fileName: string }> {
  if (file.size <= 0) throw new Error("The file is empty");
  if (file.size > MAX_BYTES) throw new Error("File size must be less than 25 MB");

  const presign = await apiRequest<{ uploadUrl: string; key: string }>("/api/files/presign", {
    method: "POST",
    body: { fileName: file.name, size: file.size },
  });

  try {
    await uploadDirect(presign.uploadUrl, file, onProgress);
    return { key: presign.key, fileName: file.name };
  } catch {
    // If the browser blocks direct uploads (CORS), upload through the server
    const key = await uploadViaServer(file, onProgress);
    return { key, fileName: file.name };
  }
}
