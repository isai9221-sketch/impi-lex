"use client";
import { useState, useRef, useEffect } from "react";
import { QUICK_PROMPTS, OFFICIAL_RESOURCES } from "@/lib/agent";
import styles from "./page.module.css";

interface Attachment {
  name: string;
  data: string; // base64
  mediaType: "image/jpeg" | "image/png" | "application/pdf";
  previewUrl: string;
}

interface Message {
  role: "user" | "assistant";
  content: string;
  // Stored content blocks (including base64) for API history
  blocks?: Array<Record<string, unknown>>;
  attachment?: { name: string; previewUrl: string };
}

function renderMarkdown(text: string): string {
  return text
    .replace(/^#### (.+)$/gm, "<h4>$1</h4>")
    .replace(/^### (.+)$/gm, "<h4>$1</h4>")
    .replace(/^## (.+)$/gm, "<h4>$1</h4>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
    .replace(/^---+$/gm, "<hr />")
    .replace(/^\d+\. (.+)$/gm, (_m, p1) => `<li class="ordered">${p1}</li>`)
    .replace(/^[-•] (.+)$/gm, (_m, p1) => `<li>${p1}</li>`)
    .replace(/(<li[^>]*>[\s\S]*?<\/li>\n?)+/g, (m) => {
      const isOrdered = m.includes('class="ordered"');
      const inner = m.replace(/ class="ordered"/g, "");
      return isOrdered ? `<ol>${inner}</ol>` : `<ul>${inner}</ul>`;
    })
    .replace(/\n\n/g, "</p><p>")
    .replace(/\n/g, "<br />");
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [attachment, setAttachment] = useState<Attachment | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // Persist conversation in localStorage
  useEffect(() => {
    const saved = localStorage.getItem("impilex-history");
    if (saved) setMessages(JSON.parse(saved));
  }, []);

  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem("impilex-history", JSON.stringify(messages));
    }
  }, [messages]);

  async function sendMessage(text?: string) {
    const query = (text ?? input).trim();
    if ((!query && !attachment) || loading) return;

    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";

    // Build content blocks for the API when there's an attachment
    let blocks: Array<Record<string, unknown>> | undefined;
    if (attachment) {
      const fileBlock = attachment.mediaType === "application/pdf"
        ? { type: "document", source: { type: "base64", media_type: attachment.mediaType, data: attachment.data } }
        : { type: "image", source: { type: "base64", media_type: attachment.mediaType, data: attachment.data } };
      blocks = query
        ? [fileBlock, { type: "text", text: query }]
        : [fileBlock];
    }

    const userMsg: Message = {
      role: "user",
      content: query,
      blocks,
      attachment: attachment ? { name: attachment.name, previewUrl: attachment.previewUrl } : undefined,
    };

    setAttachment(null);

    const newMessages: Message[] = [...messages, userMsg];
    setMessages(newMessages);
    setLoading(true);

    try {
      // Build API messages: use blocks for messages that have them, string otherwise
      const apiMessages = newMessages.map((m) => ({
        role: m.role,
        content: m.blocks ?? m.content,
      }));

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: apiMessages }),
      });
      const data = await res.json();
      const reply = data.content ?? data.error ?? "Error desconocido.";
      setMessages([...newMessages, { role: "assistant", content: reply }]);
    } catch {
      setMessages([...newMessages, { role: "assistant", content: "⚠️ Error de conexión. Verifica tu configuración." }]);
    } finally {
      setLoading(false);
    }
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    const validTypes = ["image/jpeg", "image/png", "application/pdf"];
    if (!validTypes.includes(file.type)) return;

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(",")[1];
      setAttachment({
        name: file.name,
        data: base64,
        mediaType: file.type as Attachment["mediaType"],
        previewUrl: file.type.startsWith("image/") ? result : "",
      });
    };
    reader.readAsDataURL(file);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  function handleInput(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = Math.min(e.target.scrollHeight, 140) + "px";
  }

  function clearHistory() {
    setMessages([]);
    localStorage.removeItem("impilex-history");
  }

  const piPrompts = QUICK_PROMPTS.filter((p) => p.category === "pi");
  const mktPrompts = QUICK_PROMPTS.filter((p) => p.category === "mkt");

  return (
    <div className={styles.app}>
      {/* HEADER */}
      <header className={styles.header}>
        <button className={styles.menuBtn} onClick={() => setSidebarOpen((v) => !v)} title="Menú">☰</button>
        <div className={styles.seal}>Ⅼ</div>
        <div className={styles.headerText}>
          <h1>IMPI Lex</h1>
          <p>Propiedad Intelectual · Registro de Marca · Marketing Digital · México</p>
        </div>
        <div className={styles.badges}>
          <span className={styles.badgePi}>PI & Industrial</span>
          <span className={styles.badgeMkt}>Marketing</span>
          <span className={styles.badgeLive}>En línea</span>
        </div>
        <button className={styles.clearBtn} onClick={clearHistory} title="Limpiar historial">🗑 Limpiar</button>
      </header>

      <div className={styles.layout}>
        {/* SIDEBAR */}
        {sidebarOpen && (
          <aside className={styles.sidebar}>
            <div className={styles.sideSection}>
              <div className={styles.sideLabel}>Propiedad Industrial</div>
              {piPrompts.map((p) => (
                <button key={p.label} className={styles.quickBtn} onClick={() => sendMessage(p.text)}>
                  <span>{p.icon}</span> {p.label}
                </button>
              ))}
            </div>

            <div className={styles.divider} />

            <div className={styles.sideSection}>
              <div className={styles.sideLabel}>Marketing Digital</div>
              {mktPrompts.map((p) => (
                <button key={p.label} className={styles.quickBtn} onClick={() => sendMessage(p.text)}>
                  <span>{p.icon}</span> {p.label}
                </button>
              ))}
            </div>

            <div className={styles.divider} />

            <div className={styles.sideSection}>
              <div className={styles.sideLabel}>Fuentes oficiales</div>
              {OFFICIAL_RESOURCES.map((r) => (
                <a key={r.label} href={r.url} target="_blank" rel="noopener" className={styles.resourceLink}>
                  <span className={styles.dot} style={{ background: r.color }} />
                  {r.label}
                </a>
              ))}
            </div>
          </aside>
        )}

        {/* CHAT */}
        <div className={styles.chatArea}>
          <div className={styles.messages}>
            {messages.length === 0 && (
              <div className={styles.welcomeCard}>
                <h2>Bienvenido a IMPI Lex</h2>
                <p>
                  Soy tu agente especializado en <strong>Propiedad Industrial e Intelectual en México</strong> y{" "}
                  <strong>Marketing Digital de Marca</strong>. Conozco el marco normativo vigente, los procesos
                  oficiales ante el IMPI y las estrategias digitales para posicionar y proteger tu marca.
                </p>
                <div className={styles.capGrid}>
                  {[
                    ["⚖️", "Ley de la Propiedad Industrial y reglamentos"],
                    ["🔍", "Búsqueda en Marcanet y bases IMPI"],
                    ["🗂️", "Clasificación Internacional de Niza"],
                    ["📄", "Integración de expedientes y solicitudes"],
                    ["🌐", "Protocolo de Madrid y OMPI"],
                    ["📣", "Estrategia digital, SEO y redes sociales"],
                    ["🛡️", "Vigilancia y defensa de marca online"],
                    ["📊", "Branding legal y posicionamiento"],
                  ].map(([icon, text]) => (
                    <div key={text} className={styles.capItem}>
                      <span>{icon}</span> {text}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i} className={`${styles.msg} ${msg.role === "user" ? styles.msgUser : ""}`}>
                <div className={`${styles.avatar} ${msg.role === "user" ? styles.avatarUser : styles.avatarAgent}`}>
                  {msg.role === "user" ? "TÚ" : "Ⅼ"}
                </div>
                <div className={`${styles.bubble} ${msg.role === "user" ? styles.bubbleUser : styles.bubbleAgent}`}>
                  {msg.attachment && (
                    <div className={styles.msgAttachment}>
                      {msg.attachment.previewUrl ? (
                        <img src={msg.attachment.previewUrl} alt={msg.attachment.name} className={styles.msgThumb} />
                      ) : (
                        <span className={styles.msgPdfTag}>📄 {msg.attachment.name}</span>
                      )}
                    </div>
                  )}
                  <div
                    dangerouslySetInnerHTML={{
                      __html: msg.role === "user"
                        ? msg.content.replace(/\n/g, "<br />")
                        : renderMarkdown(msg.content),
                    }}
                  />
                </div>
              </div>
            ))}

            {loading && (
              <div className={styles.msg}>
                <div className={`${styles.avatar} ${styles.avatarAgent}`}>Ⅼ</div>
                <div className={`${styles.bubble} ${styles.bubbleAgent}`}>
                  <div className={styles.typing}>
                    <span /><span /><span />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* INPUT */}
          <div className={styles.inputArea}>
            {/* Attachment preview */}
            {attachment && (
              <div className={styles.attachPreview}>
                {attachment.previewUrl ? (
                  <img src={attachment.previewUrl} alt={attachment.name} className={styles.attachThumb} />
                ) : (
                  <div className={styles.attachPdf}>📄 {attachment.name}</div>
                )}
                <button className={styles.removeAttach} onClick={() => setAttachment(null)} title="Quitar archivo">✕</button>
              </div>
            )}
            <div className={styles.inputWrapper}>
              <input
                ref={fileInputRef}
                type="file"
                accept=".jpg,.jpeg,.png,.pdf"
                onChange={handleFileChange}
                style={{ display: "none" }}
              />
              <button
                className={styles.clipBtn}
                onClick={() => fileInputRef.current?.click()}
                disabled={loading}
                title="Adjuntar imagen o PDF"
              >
                📎
              </button>
              <textarea
                ref={textareaRef}
                value={input}
                onChange={handleInput}
                onKeyDown={handleKeyDown}
                placeholder="Escribe tu consulta sobre marcas, propiedad intelectual o marketing digital…"
                rows={1}
                className={styles.textarea}
                disabled={loading}
              />
              <button
                className={styles.sendBtn}
                onClick={() => sendMessage()}
                disabled={loading || (!input.trim() && !attachment)}
              >
                ➤
              </button>
            </div>
            <p className={styles.hint}>Enter para enviar · Shift+Enter para nueva línea · 📎 Adjunta imágenes JPG/PNG o PDFs</p>
          </div>
        </div>
      </div>
    </div>
  );
}
