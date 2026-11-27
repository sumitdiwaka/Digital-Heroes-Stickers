import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';

const Ctx = createContext(null);
export const useToast = () => useContext(Ctx);

export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const dismiss = useCallback((id) => setItems((l) => l.filter((t) => t.id !== id)), []);
  const push = useCallback((type, message, ms = 4200) => {
    const id = Math.random().toString(36).slice(2);
    setItems((l) => [...l.slice(-3), { id, type, message }]);
    setTimeout(() => dismiss(id), ms);
  }, [dismiss]);
  const api = useMemo(() => ({ success: (m) => push('success', m), error: (m) => push('error', m, 6500), info: (m) => push('info', m) }), [push]);

  const icon = { success: <CheckCircle2 size={18} className="text-sage-400" />, error: <AlertTriangle size={18} className="text-signal-red" />, info: <Info size={18} className="text-copper-400" /> };
  return (
    <Ctx.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[100] flex flex-col items-center gap-2 p-4 sm:items-end safe-b" aria-live="polite">
        <AnimatePresence>
          {items.map((t) => (
            <motion.div key={t.id} layout initial={{ opacity: 0, y: 30, rotateX: -25, scale: .96 }} animate={{ opacity: 1, y: 0, rotateX: 0, scale: 1 }} exit={{ opacity: 0, x: 60 }}
              style={{ transformPerspective: 700 }}
              className="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border border-ink-600 bg-ink-800 px-4 py-3 text-sm text-paper shadow-2xl">
              <span className="mt-0.5">{icon[t.type]}</span>
              <span className="flex-1 leading-snug">{t.message}</span>
              <button onClick={() => dismiss(t.id)} className="text-paper/50 hover:text-paper" aria-label="Dismiss"><X size={16} /></button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </Ctx.Provider>
  );
}
