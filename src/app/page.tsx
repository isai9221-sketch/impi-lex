"use client";
import { useState, useRef, useEffect } from "react";
import { QUICK_PROMPTS, OFFICIAL_RESOURCES } from "@/lib/agent";
import styles from "./page.module.css";

interface Attachment {
  name: string;
  data: string;
  mediaType: "image/jpeg" | "image/png" | "application/pdf";
  previewUrl: string;
}

interface Message {
  role: "user" | "assistant";
  content: string;
  blocks?: Array<Record<string, unknown>>;
  attachment?: { name: string; previewUrl: string };
}

interface ConvMeta {
  id: string;
  title: string;
  date: string;
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

const CONV_LIST_KEY = "impilex-convs";
const convKey = (id: string) => `impilex-conv-${id}`;

function renderMarkdown(text: string): string {
  return text
    .replace(/^#### (.+)$/gm, "<h4>$1</h4>")
    .replace(/^### (.+)$/gm, "<h4>$1</h4>")
    .replace(/^## (.+)$/gm, "<h3>$1</h3>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
    .replace(/^---+$/gm, "<hr />")
    .replace(/^\| (.+)$/gm, (_m, p1) => `<tr><td>${p1.replace(/\s*\|\s*/g, "</td><td>")}</td></tr>`)
    .replace(/(<tr>[\s\S]*?<\/tr>\n?)+/g, (m) => `<table>${m}</table>`)
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

function formatDate(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "Hoy";
  if (days === 1) return "Ayer";
  if (days < 7) return `Hace ${days} días`;
  return d.toLocaleDateString("es-MX", { day: "numeric", month: "short" });
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [attachment, setAttachment] = useState<Attachment | null>(null);
  const [darkMode, setDarkMode] = useState(false);
  const [convList, setConvList] = useState<ConvMeta[]>([]);
  const [currentConvId, setCurrentConvId] = useState<string>("");
  const [piOpen, setPiOpen] = useState(true);
  const [mktOpen, setMktOpen] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Init on mount
  useEffect(() => {
    const dm = localStorage.getItem("impilex-darkmode") === "true";
    setDarkMode(dm);
    const list = JSON.parse(localStorage.getItem(CONV_LIST_KEY) || "[]") as ConvMeta[];
    setConvList(list);
    setCurrentConvId(uid());
  }, []);

  // Apply dark mode
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    localStorage.setItem("impilex-darkmode", String(darkMode));
  }, [darkMode]);

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // Persist conversation
  useEffect(() => {
    if (!currentConvId || messages.length === 0) return;
    localStorage.setItem(convKey(currentConvId), JSON.stringify(messages));
    const firstMsg = messages.find(m => m.role === "user");
    if (!firstMsg) return;
    const title = firstMsg.content.slice(0, 52) + (firstMsg.content.length > 52 ? "…" : "");
    setConvList(prev => {
      const exists = prev.find(c => c.id === currentConvId);
      if (exists) return prev;
      const updated = [{ id: currentConvId, title, date: new Date().toISOString() }, ...prev];
      localStorage.setItem(CONV_LIST_KEY, JSON.stringify(updated));
      return updated;
    });
  }, [messages, currentConvId]);

  function startNewConversation() {
    setMessages([]);
    setInput("");
    setAttachment(null);
    setCurrentConvId(uid());
  }

  function loadConversation(id: string) {
    const msgs = JSON.parse(localStorage.getItem(convKey(id)) || "[]") as Message[];
    setMessages(msgs);
    setCurrentConvId(id);
    if (window.innerWidth < 768) setSidebarOpen(false);
  }

  function deleteConversation(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    localStorage.removeItem(convKey(id));
    setConvList(prev => {
      const updated = prev.filter(c => c.id !== id);
      localStorage.setItem(CONV_LIST_KEY, JSON.stringify(updated));
      return updated;
    });
    if (id === currentConvId) startNewConversation();
  }

  async function sendMessage(text?: string) {
    const query = (text ?? input).trim();
    if ((!query && !attachment) || loading) return;

    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";

    let blocks: Array<Record<string, unknown>> | undefined;
    if (attachment) {
      const fileBlock = attachment.mediaType === "application/pdf"
        ? { type: "document", source: { type: "base64", media_type: attachment.mediaType, data: attachment.data } }
        : { type: "image", source: { type: "base64", media_type: attachment.mediaType, data: attachment.data } };
      blocks = query ? [fileBlock, { type: "text", text: query }] : [fileBlock];
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
      const apiMessages = newMessages.map(m => ({ role: m.role, content: m.blocks ?? m.content }));
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
    const valid = ["image/jpeg", "image/png", "application/pdf"];
    if (!valid.includes(file.type)) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setAttachment({
        name: file.name,
        data: result.split(",")[1],
        mediaType: file.type as Attachment["mediaType"],
        previewUrl: file.type.startsWith("image/") ? result : "",
      });
    };
    reader.readAsDataURL(file);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  }

  function handleInput(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = Math.min(e.target.scrollHeight, 140) + "px";
  }

  const piPrompts = QUICK_PROMPTS.filter(p => p.category === "pi");
  const mktPrompts = QUICK_PROMPTS.filter(p => p.category === "mkt");

  return (
    <div className={`${styles.app} ${darkMode ? styles.dark : ""}`}>

      {/* HEADER */}
      <header className={styles.header}>
        <button className={styles.menuBtn} onClick={() => setSidebarOpen(v => !v)} title="Menú">
          <svg width="18" height="14" viewBox="0 0 18 14" fill="none">
            <rect width="18" height="2" rx="1" fill="currentColor"/>
            <rect y="6" width="12" height="2" rx="1" fill="currentColor"/>
            <rect y="12" width="18" height="2" rx="1" fill="currentColor"/>
          </svg>
        </button>

        <div className={styles.logoGroup}>
          <div className={styles.seal}>Ⅼ</div>
          <div>
            <h1 className={styles.logoTitle}>IMPI Lex</h1>
            <p className={styles.logoSub}>Propiedad Industrial · Marcas · Marketing · México</p>
          </div>
        </div>

        <div className={styles.headerRight}>
          <span className={styles.badge} data-color="navy">PI & Industrial</span>
          <span className={styles.badge} data-color="sky">Marketing</span>
          <span className={styles.badge} data-color="green">En línea</span>
          <button className={styles.themeBtn} onClick={() => setDarkMode(d => !d)} title={darkMode ? "Modo claro" : "Modo oscuro"}>
            {darkMode ? "☀️" : "🌙"}
          </button>
        </div>
      </header>

      <div className={styles.layout}>

        {/* SIDEBAR */}
        {sidebarOpen && (
          <aside className={styles.sidebar}>

            {/* New conversation */}
            <div className={styles.sideTop}>
              <button className={styles.newConvBtn} onClick={startNewConversation}>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
                Nueva conversación
              </button>
            </div>

            {/* Conversation history */}
            {convList.length > 0 && (
              <div className={styles.convSection}>
                <div className={styles.sideLabel}>Historial</div>
                <div className={styles.convList}>
                  {convList.slice(0, 20).map(c => (
                    <div
                      key={c.id}
                      className={`${styles.convItem} ${c.id === currentConvId ? styles.convActive : ""}`}
                      onClick={() => loadConversation(c.id)}
                    >
                      <div className={styles.convItemContent}>
                        <span className={styles.convTitle}>{c.title}</span>
                        <span className={styles.convDate}>{formatDate(c.date)}</span>
                      </div>
                      <button className={styles.convDelete} onClick={e => deleteConversation(c.id, e)} title="Eliminar">✕</button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className={styles.divider} />

            {/* PI Prompts */}
            <div className={styles.sideSection}>
              <button className={styles.sectionToggle} onClick={() => setPiOpen(v => !v)}>
                <span className={styles.sideLabel}>Propiedad Industrial</span>
                <span className={`${styles.chevron} ${piOpen ? styles.chevronOpen : ""}`}>›</span>
              </button>
              {piOpen && piPrompts.map(p => (
                <button key={p.label} className={styles.quickBtn} onClick={() => sendMessage(p.text)}>
                  <span className={styles.qIcon}>{p.icon}</span>
                  <span>{p.label}</span>
                </button>
              ))}
            </div>

            <div className={styles.divider} />

            {/* Marketing Prompts */}
            <div className={styles.sideSection}>
              <button className={styles.sectionToggle} onClick={() => setMktOpen(v => !v)}>
                <span className={styles.sideLabel}>Marketing Digital</span>
                <span className={`${styles.chevron} ${mktOpen ? styles.chevronOpen : ""}`}>›</span>
              </button>
              {mktOpen && mktPrompts.map(p => (
                <button key={p.label} className={styles.quickBtn} onClick={() => sendMessage(p.text)}>
                  <span className={styles.qIcon}>{p.icon}</span>
                  <span>{p.label}</span>
                </button>
              ))}
            </div>

            <div className={styles.divider} />

            {/* Resources */}
            <div className={styles.sideSection}>
              <div className={styles.sideLabel}>Fuentes oficiales</div>
              {OFFICIAL_RESOURCES.map(r => (
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

            {/* Welcome */}
            {messages.length === 0 && (
              <div className={styles.welcomeCard}>
                <div className={styles.welcomeIcon}>Ⅼ</div>
                <h2 className={styles.welcomeTitle}>Bienvenido a IMPI Lex</h2>
                <p className={styles.welcomeText}>
                  Agente especializado en <strong>Propiedad Industrial e Intelectual en México</strong> y{" "}
                  <strong>Marketing Digital de Marca</strong>. Consulto fuentes oficiales en tiempo real.
                </p>
                <div className={styles.capGrid}>
                  {[
                    ["⚖️", "Marco normativo LFPPI y reglamentos"],
                    ["🔍", "Búsqueda en acervo IMPI y Marcanet"],
                    ["🗂️", "Clasificación Internacional de Niza"],
                    ["📄", "Expedientes y solicitudes de registro"],
                    ["🌐", "Protocolo de Madrid y OMPI"],
                    ["📣", "Estrategia digital, SEO y redes"],
                    ["🛡️", "Vigilancia y defensa de marca online"],
                    ["📎", "Analiza imágenes de logotipos y PDFs"],
                  ].map(([icon, text]) => (
                    <div key={text as string} className={styles.capItem}>
                      <span>{icon}</span> {text as string}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Messages */}
            {messages.map((msg, i) => (
              <div key={i} className={`${styles.msg} ${msg.role === "user" ? styles.msgUser : styles.msgAgent}`}>
                <div className={`${styles.avatar} ${msg.role === "user" ? styles.avatarUser : styles.avatarAgent}`}>
                  {msg.role === "user" ? "TÚ" : "Ⅼ"}
                </div>
                <div className={`${styles.bubble} ${msg.role === "user" ? styles.bubbleUser : styles.bubbleAgent}`}>
                  {msg.attachment && (
                    <div className={styles.msgAttachment}>
                      {msg.attachment.previewUrl
                        ? <img src={msg.attachment.previewUrl} alt={msg.attachment.name} className={styles.msgThumb} />
                        : <span className={styles.msgPdfTag}>📄 {msg.attachment.name}</span>
                      }
                    </div>
                  )}
                  <div dangerouslySetInnerHTML={{
                    __html: msg.role === "user"
                      ? msg.content.replace(/\n/g, "<br />")
                      : renderMarkdown(msg.content),
                  }} />
                </div>
              </div>
            ))}

            {/* Loading / Search indicator */}
            {loading && (
              <div className={styles.msg}>
                <div className={`${styles.avatar} ${styles.avatarAgent}`}>Ⅼ</div>
                <div className={styles.searchBanner}>
                  <span className={styles.globeIcon}>🌐</span>
                  <span className={styles.searchText}>Consultando fuentes oficiales…</span>
                  <span className={styles.searchDots}><span/><span/><span/></span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* INPUT */}
          <div className={styles.inputArea}>
            {attachment && (
              <div className={styles.attachPreview}>
                {attachment.previewUrl
                  ? <img src={attachment.previewUrl} alt={attachment.name} className={styles.attachThumb} />
                  : <div className={styles.attachPdf}>📄 {attachment.name}</div>
                }
                <button className={styles.removeAttach} onClick={() => setAttachment(null)}>✕</button>
              </div>
            )}
            <div className={styles.inputWrapper}>
              <input ref={fileInputRef} type="file" accept=".jpg,.jpeg,.png,.pdf" onChange={handleFileChange} style={{ display: "none" }} />
              <button className={styles.clipBtn} onClick={() => fileInputRef.current?.click()} disabled={loading} title="Adjuntar imagen o PDF">
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
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M14 8L2 2l2.5 6L2 14l12-6z" fill="currentColor"/>
                </svg>
              </button>
            </div>
            <p className={styles.hint}>Enter para enviar · Shift+Enter nueva línea · 📎 Adjunta imágenes o PDFs</p>
          </div>
        </div>
      </div>
    </div>
  );
}
