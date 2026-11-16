"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  MessageSquare,
  Search,
  Send,
  Paperclip,
  FileText,
  Image as ImageIcon,
  Mic,
  Phone,
  Building2,
  Check,
  CheckCheck,
  AlertCircle,
  RefreshCw,
  X,
  Download,
  Clock,
  ExternalLink,
  Loader2,
} from "lucide-react";

export interface WhatsAppMessage {
  id: string;
  phone_number: string;
  contact_name: string | null;
  company_name: string | null;
  direction: "inbound" | "outbound";
  message_type: "text" | "image" | "document" | "audio" | "voice" | "video" | "location" | "template" | "interactive";
  content: string | null;
  media_id: string | null;
  media_url: string | null;
  media_mime_type: string | null;
  media_filename: string | null;
  meta_message_id: string | null;
  status: "received" | "sent" | "delivered" | "read" | "failed";
  is_read: boolean;
  error_message?: string | null;
  created_at: string;
}

export interface WhatsAppConversationSummary {
  phoneNumber: string;
  contactName: string | null;
  companyName: string | null;
  lastMessage: {
    content: string | null;
    messageType: string;
    direction: "inbound" | "outbound";
    createdAt: string;
    status: string;
  };
  unreadCount: number;
  lastInboundAt: string | null;
  isWindowActive: boolean;
  windowExpiresAt: string | null;
}

export const AdminWhatsAppInboxView: React.FC<{
  onUnreadCountUpdate?: (count: number) => void;
}> = ({ onUnreadCountUpdate }) => {
  const [conversations, setConversations] = useState<WhatsAppConversationSummary[]>([]);
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null);
  const [messages, setMessages] = useState<WhatsAppMessage[]>([]);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [inputText, setInputText] = useState("");
  const [sending, setSending] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [previewImageModal, setPreviewImageModal] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Load conversations list
  const fetchConversations = useCallback(async (silent = false) => {
    if (!silent) setLoadingConversations(true);
    try {
      const res = await fetch("/api/admin/whatsapp/conversations");
      if (res.ok) {
        const data = await res.json();
        const convList: WhatsAppConversationSummary[] = data.conversations || [];
        setConversations(convList);

        const totalUnread = convList.reduce((acc, c) => acc + (c.unreadCount || 0), 0);
        onUnreadCountUpdate?.(totalUnread);

        // Auto-select first conversation if none selected
        if (!selectedPhone && convList.length > 0) {
          setSelectedPhone(convList[0].phoneNumber);
        }
      }
    } catch (e) {
      console.error("Failed to load WhatsApp conversations:", e);
    } finally {
      if (!silent) setLoadingConversations(false);
    }
  }, [onUnreadCountUpdate, selectedPhone]);

  // Load messages for selected conversation
  const fetchMessages = useCallback(async (phone: string, silent = false) => {
    if (!silent) setLoadingMessages(true);
    try {
      const res = await fetch(`/api/admin/whatsapp/messages?phone=${encodeURIComponent(phone)}`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
      }
    } catch (e) {
      console.error("Failed to load WhatsApp messages:", e);
    } finally {
      if (!silent) setLoadingMessages(false);
    }
  }, []);

  // Initial load & 12-second polling for live incoming messages
  useEffect(() => {
    fetchConversations();
    const interval = setInterval(() => {
      fetchConversations(true);
    }, 12000);
    return () => clearInterval(interval);
  }, [fetchConversations]);

  // When selectedPhone changes, load its message thread
  useEffect(() => {
    if (selectedPhone) {
      fetchMessages(selectedPhone);
    } else {
      setMessages([]);
    }
  }, [selectedPhone, fetchMessages]);

  // Auto-scroll messages to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, selectedPhone]);

  // Active conversation object
  const activeConversation = useMemo(() => {
    return conversations.find((c) => c.phoneNumber === selectedPhone) || null;
  }, [conversations, selectedPhone]);

  // Filter conversations by search query
  const filteredConversations = useMemo(() => {
    if (!searchQuery.trim()) return conversations;
    const q = searchQuery.toLowerCase().trim();
    return conversations.filter(
      (c) =>
        c.phoneNumber.includes(q) ||
        (c.contactName && c.contactName.toLowerCase().includes(q)) ||
        (c.companyName && c.companyName.toLowerCase().includes(q))
    );
  }, [conversations, searchQuery]);

  // Format relative timestamp
  const formatTime = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } catch {
      return "";
    }
  };

  const formatDateLabel = (isoString: string) => {
    try {
      const d = new Date(isoString);
      const today = new Date();
      if (d.toDateString() === today.toDateString()) return "Today";
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
      return d.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
    } catch {
      return "";
    }
  };

  const renderMessageContent = (content: string, isInbound: boolean) => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = content.split(urlRegex);

    return parts.map((part, i) => {
      if (part.match(urlRegex)) {
        return (
          <a
            key={i}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#53bdeb] underline underline-offset-2 break-all font-medium hover:text-[#70c9f1] transition-colors"
          >
            {part}
          </a>
        );
      }
      return part;
    });
  };

  // Handle send message
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!selectedPhone || sending) return;

    const textToSend = inputText.trim();
    if (!textToSend && !selectedFile) return;

    setSending(true);

    try {
      let mediaId: string | undefined = undefined;
      let mediaFilename: string | undefined = undefined;
      let type: "text" | "image" | "document" | "audio" = "text";

      // 1. Upload media if file selected
      if (selectedFile) {
        setUploadingMedia(true);
        const formData = new FormData();
        formData.append("file", selectedFile);

        const uploadRes = await fetch("/api/admin/whatsapp/upload", {
          method: "POST",
          body: formData,
        });

        const uploadData = await uploadRes.json();
        setUploadingMedia(false);

        if (!uploadRes.ok || !uploadData.mediaId) {
          alert(`File upload failed: ${uploadData.error || "Unknown error"}`);
          setSending(false);
          return;
        }

        mediaId = uploadData.mediaId;
        mediaFilename = selectedFile.name;

        if (selectedFile.type.startsWith("image/")) {
          type = "image";
        } else if (selectedFile.type.startsWith("audio/")) {
          type = "audio";
        } else {
          type = "document";
        }
      }

      // 2. Send message
      const payload: Record<string, unknown> = {
        phone: selectedPhone,
        type,
        text: textToSend,
        mediaId,
        mediaFilename,
        mediaCaption: textToSend || undefined,
      };

      const sendRes = await fetch("/api/admin/whatsapp/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const sendData = await sendRes.json();
      if (!sendRes.ok) {
        alert(`Message send failed: ${sendData.error || "Please check 24h window"}`);
      } else {
        setInputText("");
        setSelectedFile(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
        // Refresh conversation messages
        await fetchMessages(selectedPhone, true);
        await fetchConversations(true);
      }
    } catch (err) {
      console.error("Exception sending message:", err);
      alert("Network exception sending message");
    } finally {
      setSending(false);
      setUploadingMedia(false);
    }
  };

  // Keyboard shortcut: Enter sends message, Shift+Enter makes newline
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="flex h-full w-full min-h-0 overflow-hidden bg-[#0b141a] text-[#e9edef]">
      {/* ─────────────────────────────────────────────────────────────
          LEFT PANEL: Conversations List & Search
      ───────────────────────────────────────────────────────────── */}
      <div className="flex flex-col w-80 lg:w-96 h-full min-h-0 border-r border-[#222e35] bg-[#111b21] shrink-0">
        {/* Left Header */}
        <div className="p-4 border-b border-[#222e35] space-y-3 bg-[#111b21]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageSquare size={16} className="text-[#00a884]" />
              <h2 className="font-headline text-sm font-bold text-[#e9edef] tracking-tight">
                WhatsApp Inbox
              </h2>
            </div>
            <button
              onClick={() => fetchConversations()}
              className="p-1.5 rounded-[5px] text-[#8696a0] hover:text-[#e9edef] hover:bg-[#202c33] transition-colors cursor-pointer"
              title="Refresh inbox"
            >
              <RefreshCw size={14} className={loadingConversations ? "animate-spin" : ""} />
            </button>
          </div>

          {/* Search Bar */}
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#8696a0]" />
            <input
              type="text"
              placeholder="Search by name, company, or phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 rounded-[5px] bg-[#202c33] border border-[#2a3942] text-xs text-[#e9edef] placeholder:text-[#8696a0] focus:outline-none focus:border-[#00a884]"
            />
          </div>
        </div>

        {/* Conversation List Scroll Area */}
        <div className="flex-1 overflow-y-auto divide-y divide-[#222e35]">
          {loadingConversations ? (
            <div className="flex flex-col items-center justify-center p-8 text-xs text-[#8696a0] gap-2">
              <Loader2 size={18} className="animate-spin text-[#00a884]" />
              <span>Loading WhatsApp chats…</span>
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="p-6 text-center text-xs text-[#8696a0] space-y-1">
              <p className="font-semibold text-[#e9edef]">No conversations found</p>
              <p className="text-[11px]">
                {searchQuery ? "Try a different search term" : "Incoming WhatsApp messages will appear here automatically"}
              </p>
            </div>
          ) : (
            filteredConversations.map((conv) => {
              const isSelected = selectedPhone === conv.phoneNumber;
              const title = conv.companyName || conv.contactName || `+${conv.phoneNumber}`;

              return (
                <button
                  key={conv.phoneNumber}
                  onClick={() => setSelectedPhone(conv.phoneNumber)}
                  className={`w-full text-left p-3.5 flex items-start gap-3 transition-colors cursor-pointer ${
                    isSelected
                      ? "bg-[#2a3942]"
                      : "hover:bg-[#202c33]/70"
                  }`}
                >
                  {/* Initials Avatar */}
                  <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-[5px] bg-[#202c33] border border-[#2a3942] font-mono text-xs font-bold text-[#e9edef] uppercase">
                    {title.slice(0, 2)}
                    {/* Online Indicator Dot */}
                    {conv.isWindowActive && (
                      <span
                        className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-[#00a884] border-2 border-[#111b21]"
                        title="Online"
                      />
                    )}
                  </div>

                  {/* Thread Summary */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <h3 className="font-semibold text-xs text-[#e9edef] truncate">
                          {title}
                        </h3>
                        {conv.companyName && conv.contactName && (
                          <span className="text-[10px] text-[#8696a0] truncate shrink font-normal">
                            • {conv.contactName}
                          </span>
                        )}
                      </div>
                      {conv.lastMessage.createdAt && (
                        <span className="font-mono text-[10px] text-[#8696a0] shrink-0 ml-1">
                          {formatTime(conv.lastMessage.createdAt)}
                        </span>
                      )}
                    </div>

                    <p className="text-[11px] text-[#8696a0] truncate mt-1">
                      {conv.lastMessage.direction === "outbound" && (
                        <span className="font-medium text-[#e9edef]/80">You: </span>
                      )}
                      {conv.lastMessage.messageType === "image" && "📷 Photo"}
                      {conv.lastMessage.messageType === "document" && "📄 Document"}
                      {(conv.lastMessage.messageType === "voice" || conv.lastMessage.messageType === "audio") && "🎙️ Voice message"}
                      {!["image", "document", "voice", "audio"].includes(conv.lastMessage.messageType) &&
                        (conv.lastMessage.content || "Message")}
                    </p>
                  </div>

                  {/* Unread badge */}
                  {conv.unreadCount > 0 && (
                    <span className="ml-1 shrink-0 px-1.5 py-0.5 rounded-[4px] bg-[#00a884] text-[#111b21] font-mono text-[10px] font-bold">
                      {conv.unreadCount}
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          RIGHT PANEL: Active Chat Thread & Compose
      ───────────────────────────────────────────────────────────── */}
      {selectedPhone && activeConversation ? (
        <div className="flex flex-1 flex-col h-full min-h-0 min-w-0 bg-[var(--background)]">
          {/* Top Bar Header */}
          <div className="h-16 px-6 border-b border-[#222e35] bg-[#202c33] flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[5px] bg-[#2a3942] border border-[#2f3b43] font-mono text-xs font-bold uppercase text-[#e9edef]">
                {(activeConversation.companyName || activeConversation.contactName || activeConversation.phoneNumber).slice(0, 2)}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-headline text-sm font-bold text-[#e9edef] truncate">
                    {activeConversation.companyName || activeConversation.contactName || `+${activeConversation.phoneNumber}`}
                  </h3>
                  {activeConversation.companyName && activeConversation.contactName && (
                    <span className="px-1.5 py-0.5 rounded-[3px] bg-[#2a3942] text-[10px] font-medium text-[#8696a0]">
                      {activeConversation.contactName}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 font-mono text-[11px] text-[#8696a0] mt-0.5">
                  <Phone size={10} />
                  <span>+{activeConversation.phoneNumber}</span>
                </div>
              </div>
            </div>

            {/* Online Status Badge */}
            <div className="flex items-center gap-2">
              {activeConversation.isWindowActive && (
                <div className="flex items-center gap-2 px-2.5 py-1 rounded-[5px] border border-[#2a3942] bg-[#111b21] text-xs text-[#8696a0]">
                  <span className="h-2 w-2 rounded-full bg-[#00a884] shrink-0" />
                  <span className="text-[11px] font-medium text-[#e9edef]">Online</span>
                </div>
              )}
            </div>
          </div>

          {/* Messages Scroll Area */}
          <div className="flex-1 min-h-0 overflow-y-auto p-4 md:p-6 space-y-4 bg-[#0b141a]">
            {loadingMessages ? (
              <div className="flex items-center justify-center h-full text-xs text-[#8696a0] gap-2">
                <Loader2 size={18} className="animate-spin text-[#00a884]" />
                <span>Loading messages…</span>
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center text-xs text-[#8696a0] space-y-2">
                <MessageSquare size={32} className="text-[#222e35]" />
                <p className="font-semibold text-[#e9edef]">No messages yet</p>
                <p className="max-w-xs text-[11px]">
                  Send a message below to start chatting with this customer on WhatsApp.
                </p>
              </div>
            ) : (
              messages.map((msg, index) => {
                const isInbound = msg.direction === "inbound";
                const isOutbound = msg.direction === "outbound";
                const prevMsg = index > 0 ? messages[index - 1] : null;
                const showDateLabel = !prevMsg || formatDateLabel(prevMsg.created_at) !== formatDateLabel(msg.created_at);

                return (
                  <React.Fragment key={msg.id || msg.meta_message_id || index}>
                    {/* Date Divider Pill */}
                    {showDateLabel && (
                      <div className="flex justify-center my-3">
                        <span className="px-3 py-1 rounded-[5px] bg-[#182229] border border-[#222e35] text-[10px] font-mono font-medium text-[#8696a0] shadow-sm">
                          {formatDateLabel(msg.created_at)}
                        </span>
                      </div>
                    )}

                    {/* Chat Bubble */}
                    <div className={`flex w-full ${isInbound ? "justify-start" : "justify-end"}`}>
                      <div
                        className={`max-w-[85%] sm:max-w-[540px] rounded-[5px] p-3 text-xs shadow-sm space-y-2 break-words ${
                          isInbound
                            ? "bg-[#202c33] border border-[#222e35] text-[#e9edef]"
                            : "bg-[#005c4b] border border-[#005c4b] text-[#e9edef]"
                        }`}
                      >
                        {/* 1. Image message */}
                        {msg.message_type === "image" && (
                          <div className="space-y-1.5">
                            {msg.media_id ? (
                              <button
                                type="button"
                                onClick={() => setPreviewImageModal(`/api/admin/whatsapp/media/${msg.media_id}`)}
                                className="block rounded-[4px] overflow-hidden border border-black/10 dark:border-white/10 hover:opacity-95 transition-opacity"
                              >
                                <img
                                  src={`/api/admin/whatsapp/media/${msg.media_id}`}
                                  alt={msg.content || "WhatsApp Image"}
                                  className="max-h-64 w-full object-cover rounded-[4px]"
                                  loading="lazy"
                                />
                              </button>
                            ) : msg.media_url ? (
                              <button
                                type="button"
                                onClick={() => setPreviewImageModal(msg.media_url)}
                                className="block rounded-[4px] overflow-hidden border border-black/10 dark:border-white/10 hover:opacity-95 transition-opacity"
                              >
                                <img
                                  src={msg.media_url}
                                  alt={msg.content || "WhatsApp Image"}
                                  className="max-h-64 w-full object-cover rounded-[4px]"
                                  loading="lazy"
                                />
                              </button>
                            ) : (
                              <div className="flex items-center gap-2 p-3 bg-black/10 rounded-[4px]">
                                <ImageIcon size={16} />
                                <span>Image attachment</span>
                              </div>
                            )}
                            {msg.content && (
                              <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                            )}
                          </div>
                        )}

                        {/* 2. Document / PDF message */}
                        {msg.message_type === "document" && (
                          <div className="space-y-1.5">
                            <div
                              className={`flex items-center justify-between gap-3 p-2.5 rounded-[4px] border ${
                                isInbound
                                  ? "bg-[var(--background)] border-[var(--border)]"
                                  : "bg-black/10 border-white/20 text-[var(--background)]"
                              }`}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <FileText size={20} className={isInbound ? "text-rose-500" : "text-rose-300"} />
                                <div className="min-w-0">
                                  <p className="font-semibold truncate text-[11px]">
                                    {msg.media_filename || "Document.pdf"}
                                  </p>
                                  <span className="text-[10px] opacity-75 uppercase font-mono">
                                    PDF Document
                                  </span>
                                </div>
                              </div>
                              {msg.media_id && (
                                <a
                                  href={`/api/admin/whatsapp/media/${msg.media_id}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  download={msg.media_filename || "document.pdf"}
                                  className={`p-1.5 rounded-[4px] transition-colors cursor-pointer shrink-0 ${
                                    isInbound
                                      ? "bg-[var(--accent)] hover:bg-[var(--border)] text-[var(--foreground)]"
                                      : "bg-white/20 hover:bg-white/30 text-[var(--background)]"
                                  }`}
                                  title="View or download document"
                                >
                                  <Download size={14} />
                                </a>
                              )}
                            </div>
                            {msg.content && (
                              <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                            )}
                          </div>
                        )}

                        {/* 3. Audio / Voice note message */}
                        {(msg.message_type === "audio" || msg.message_type === "voice") && (
                          <div className="space-y-1.5">
                            <div className="flex items-center gap-2 mb-1">
                              <Mic size={14} className={isInbound ? "text-emerald-500" : "text-emerald-300"} />
                              <span className="font-mono text-[11px] font-semibold">
                                {msg.message_type === "voice" ? "Voice Note" : "Audio"}
                              </span>
                            </div>
                            {msg.media_id ? (
                              <audio
                                controls
                                preload="metadata"
                                className="w-full max-w-[260px] h-8"
                                src={`/api/admin/whatsapp/media/${msg.media_id}`}
                              />
                            ) : (
                              <p className="text-[11px] opacity-75">Voice message recorded</p>
                            )}
                          </div>
                        )}

                        {/* 4. Text / Fallback message */}
                        {!["image", "document", "audio", "voice"].includes(msg.message_type) && (
                          <div className="space-y-2">
                            <p className="whitespace-pre-wrap leading-relaxed font-sans break-words text-[#e9edef]">
                              {renderMessageContent(msg.content || "", isInbound)}
                            </p>
                            {msg.message_type === "template" && (() => {
                              const urlMatch = msg.content?.match(/https?:\/\/[^\s]+/);
                              const targetUrl = urlMatch ? urlMatch[0] : (activeConversation.companyName ? `https://nammainfo.in/${activeConversation.companyName.toLowerCase()}` : "https://nammainfo.in");
                              return (
                                <div className="pt-2 border-t border-white/10 flex items-center justify-center">
                                  <a
                                    href={targetUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1.5 py-1 px-3 rounded-[4px] text-xs font-semibold text-[#53bdeb] hover:bg-white/10 transition-colors cursor-pointer w-full justify-center"
                                  >
                                    <ExternalLink size={13} />
                                    <span>view your profile</span>
                                  </a>
                                </div>
                              );
                            })()}
                          </div>
                        )}

                        {/* Footer: Timestamp and status tick */}
                        <div
                          className={`flex items-center justify-end gap-1.5 text-[10px] font-mono mt-1 ${
                            isInbound ? "text-[#8696a0]" : "text-[#e9edef]/70"
                          }`}
                        >
                          <span>{formatTime(msg.created_at)}</span>
                          {isOutbound && (
                            <span className="inline-flex items-center">
                              {msg.status === "read" && <CheckCheck size={14} className="text-[#53bdeb]" />}
                              {msg.status === "delivered" && <CheckCheck size={14} className="text-[#8696a0]" />}
                              {msg.status === "sent" && <Check size={14} className="text-[#8696a0]" />}
                              {msg.status === "failed" && (
                                <span title={msg.error_message || "Send failed"}>
                                  <AlertCircle size={14} className="text-rose-400" />
                                </span>
                              )}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </React.Fragment>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Attachment Preview Chip (Before sending) */}
          {selectedFile && (
            <div className="px-6 py-2 bg-[#202c33] border-t border-[#222e35] flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs text-[#e9edef]">
                {selectedFile.type.startsWith("image/") ? (
                  <ImageIcon size={14} className="text-[#00a884]" />
                ) : (
                  <FileText size={14} className="text-rose-400" />
                )}
                <span className="font-medium truncate max-w-sm">{selectedFile.name}</span>
                <span className="text-[10px] font-mono text-[#8696a0]">
                  ({(selectedFile.size / 1024).toFixed(0)} KB)
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedFile(null);
                  if (fileInputRef.current) fileInputRef.current.value = "";
                }}
                className="text-[#8696a0] hover:text-rose-400 p-1 rounded-[3px] transition-colors cursor-pointer"
              >
                <X size={14} />
              </button>
            </div>
          )}

          {/* Bottom Input Composer */}
          <form
            onSubmit={handleSendMessage}
            className="p-3 md:p-4 border-t border-[#222e35] bg-[#202c33] flex items-end gap-2 shrink-0"
          >
            {/* Hidden file input */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  setSelectedFile(e.target.files[0]);
                }
              }}
              accept="image/*,application/pdf,audio/*"
              className="hidden"
            />

            {/* Paperclip Attachment Button */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="p-2 rounded-[5px] text-[#8696a0] hover:text-[#e9edef] hover:bg-[#2a3942] transition-colors cursor-pointer shrink-0"
              title="Attach PDF document or photo"
            >
              <Paperclip size={18} />
            </button>

            {/* Textarea */}
            <div className="flex-1 relative">
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type a message..."
                rows={1}
                className="w-full resize-none rounded-[5px] bg-[#2a3942] border border-[#2f3b43] p-2.5 text-xs text-[#e9edef] placeholder:text-[#8696a0] focus:outline-none focus:border-[#00a884] max-h-32"
              />
            </div>

            {/* Send Button */}
            <button
              type="submit"
              disabled={sending || (!inputText.trim() && !selectedFile)}
              className="h-[38px] px-4 rounded-[5px] bg-[#00a884] text-[#111b21] font-semibold text-xs flex items-center gap-1.5 hover:bg-[#02906f] transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shrink-0"
            >
              {sending || uploadingMedia ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Send size={14} />
              )}
              <span>Send</span>
            </button>
          </form>
        </div>
      ) : (
        /* Empty State: No chat selected */
        <div className="flex flex-1 flex-col items-center justify-center p-8 text-center text-xs text-[var(--muted-foreground)] bg-[var(--background)] space-y-3">
          <div className="flex h-16 w-16 items-center justify-center rounded-[5px] border border-[var(--border)] bg-[var(--card)] text-[var(--muted-foreground)]">
            <MessageSquare size={32} />
          </div>
          <div>
            <h3 className="font-headline text-base font-bold text-[var(--foreground)]">
              WhatsApp Admin Inbox
            </h3>
            <p className="max-w-sm text-xs text-[var(--muted-foreground)] mt-1">
              Select a conversation from the left to view customer messages, voice notes, photos, and send PDF card designs.
            </p>
          </div>
        </div>
      )}

      {/* Image Preview Lightbox Modal */}
      {previewImageModal && (
        <div
          onClick={() => setPreviewImageModal(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 cursor-pointer"
        >
          <div className="relative max-w-4xl max-h-[90vh]">
            <button
              type="button"
              onClick={() => setPreviewImageModal(null)}
              className="absolute -top-10 right-0 p-1.5 text-white/80 hover:text-white rounded-[5px] bg-black/50"
            >
              <X size={20} />
            </button>
            <img
              src={previewImageModal}
              alt="Full preview"
              className="max-h-[85vh] max-w-full rounded-[5px] object-contain shadow-2xl"
            />
          </div>
        </div>
      )}
    </div>
  );
};
