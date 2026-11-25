import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Bell } from 'lucide-react';
import { createPortal } from 'react-dom';

const NotificationPanel = ({ isOpen, onClose }) => {
  // Notifications are not yet implemented in the backend; the panel is a placeholder.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.aside
            className="fixed top-0 right-0 bottom-0 z-50 w-full sm:w-96 bg-app-bg-secondary border-l border-app-border shadow-2xl flex flex-col"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'tween', duration: 0.25, ease: 'easeOut' }}
          >
            <div className="flex items-center justify-between p-5 border-b border-app-border">
              <div className="flex items-center gap-2">
                <Bell size={18} className="text-app-accent" />
                <h2 className="text-base font-semibold text-app-text-primary">
                  Notifications
                </h2>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg hover:bg-app-bg-tertiary text-app-text-muted hover:text-app-text-primary transition"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              <div className="flex flex-col items-center justify-center h-full text-center p-8 text-sm text-app-text-muted">
                <Bell size={28} className="mb-2 opacity-50" />
                Notifications coming soon.
              </div>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
};

export default NotificationPanel;
