export const MAX_JSON_BODY_BYTES = 8 * 1024;

export async function readRequestBody(
  request: AsyncIterable<unknown>,
  maxBytes: number,
  contentLength?: string,
): Promise<{ bodyBytes?: Buffer; bodyTooLarge?: boolean }> {
  if (contentLength !== undefined && Number(contentLength) > maxBytes) {
    return { bodyTooLarge: true };
  }
  const chunks: Buffer[] = [];
  let bytesRead = 0;
  let bodyTooLarge = false;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk));
    bytesRead += buffer.byteLength;
    if (bytesRead > maxBytes) {
      bodyTooLarge = true;
      chunks.length = 0;
    } else if (!bodyTooLarge) {
      chunks.push(buffer);
    }
  }
  return bodyTooLarge ? { bodyTooLarge: true } : { bodyBytes: Buffer.concat(chunks, bytesRead) };
}
