"use client";

import { useState } from "react";
import { ChatList } from "./ChatList";
import { ChatView } from "./ChatView";

// The full product — chat list + voice/text chat — embedded directly on the
// landing page. Works with no sign-in (fingerprint identity, see
// lib/fingerprint.ts + resolveIdentity in lib/auth.ts); signing in just
// upgrades the same view from the anonymous credit pool to a real account.
export function TranslatorApp() {
  const [chatId, setChatId] = useState<string | null>(null);

  return (
    <div className="flex h-[640px] max-h-[80vh] min-h-[420px] flex-col overflow-hidden">
      {chatId ? (
        <ChatView chatId={chatId} onBack={() => setChatId(null)} />
      ) : (
        <ChatList onOpenChat={setChatId} />
      )}
    </div>
  );
}
