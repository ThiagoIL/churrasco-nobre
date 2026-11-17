import { createHash, randomBytes } from "node:crypto";

/** Token aleatório de 256 bits (base64url). Vai para o cookie/e-mail; no banco fica só o hash. */
export const newToken = () => randomBytes(32).toString("base64url");

/** SHA-256 em hexadecimal. */
export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");
