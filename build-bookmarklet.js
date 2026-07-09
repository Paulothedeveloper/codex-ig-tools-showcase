/* Gera o bookmarklet (codex-ig.bookmarklet.txt) a partir de codex-ig.js.
   Estrategia a prova de bala: NAO minifica de forma agressiva (nada de
   tokenizer que pode quebrar). So remove o comentario-banner de bloco e a
   indentacao de cada linha, mantendo as quebras de linha (encoded %0A),
   entao o comportamento e IDENTICO ao codex-ig.js validado.
   node build-bookmarklet.js */
const fs = require("fs");
const path = require("path");
const dir = __dirname;

let src = fs.readFileSync(path.join(dir, "codex-ig.js"), "utf8");
const rawBytes = Buffer.byteLength(src);

// remove só o(s) comentário(s) de bloco /* ... */ (aqui = apenas o banner; não há /* dentro de strings)
src = src.replace(/\/\*[\s\S]*?\*\//g, "");
// trim da indentação por linha + tira linhas vazias; mantém \n para que // comentários terminem certo
src = src.split("\n").map((l) => l.replace(/^\s+/, "")).filter((l) => l.length).join("\n");

const bookmarklet = "javascript:" + encodeURIComponent(src) + "%0Avoid%200";
fs.writeFileSync(path.join(dir, "codex-ig.bookmarklet.txt"), bookmarklet);

// injeta o bookmarklet no template -> install.html (self-contained, funciona local e no Pages)
const tpl = fs.readFileSync(path.join(dir, "install.template.html"), "utf8");
if (/[<>"\\]/.test(bookmarklet)) throw new Error("bookmarklet tem char inseguro pra HTML — abortando");
fs.writeFileSync(path.join(dir, "install.html"), tpl.replace("__BOOKMARKLET__", bookmarklet));

console.log("fonte original:", rawBytes, "bytes");
console.log("bookmarklet   :", Buffer.byteLength(bookmarklet), "bytes");
console.log("gravado -> codex-ig.bookmarklet.txt + install.html");
