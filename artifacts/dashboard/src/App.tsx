import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useState, useEffect, useRef, createContext, useContext } from "react";
import { api } from "./lib/api";
import Home from "./pages/Home";
import Login from "./pages/Login";
import GuildSelect from "./pages/GuildSelect";
import Apply from "./pages/Apply";
import DashboardLayout from "./components/DashboardLayout";
import Overview from "./pages/dashboard/Overview";
import YamlConfig from "./pages/dashboard/YamlConfig";
import Docs from "./pages/Docs";

interface AuthCtx {
  user: any | null;
  loading: boolean;
  refetch: () => void;
}

interface MusicCtx {
  muted: boolean;
  toggleMute: () => void;
}

export const AuthContext = createContext<AuthCtx>({ user: null, loading: true, refetch: () => {} });
export const MusicContext = createContext<MusicCtx>({ muted: false, toggleMute: () => {} });
export const useAuth = () => useContext(AuthContext);
export const useMusic = () => useContext(MusicContext);

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div style={{ display:"flex",alignItems:"center",justifyContent:"center",height:"100vh",color:"var(--accent)" }}>Loading…</div>;
  if (!user) return <Navigate to="/" replace />;
  return <>{children}</>;
}

export default function App() {
  const [user, setUser] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [muted, setMuted] = useState(false);
  const [needsClick, setNeedsClick] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const startedRef = useRef(false);

  const refetch = () => {
    setLoading(true);
    api.auth.me().then(setUser).catch(() => setUser(null)).finally(() => setLoading(false));
  };

  useEffect(() => { refetch(); }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.muted = muted;
    if (!muted && !startedRef.current) {
      audio.play().then(() => {
        startedRef.current = true;
        setNeedsClick(false);
      }).catch(() => {
        setNeedsClick(true);
      });
    } else if (!muted && startedRef.current) {
      audio.play().catch(() => {});
    } else {
      audio.pause();
    }
  }, [muted]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.play().then(() => {
      startedRef.current = true;
      setNeedsClick(false);
    }).catch(() => {
      setNeedsClick(true);
    });
  }, []);

  useEffect(() => {
    if (!needsClick) return;
    const unlock = () => {
      const audio = audioRef.current;
      if (!audio || startedRef.current || muted) return;
      audio.play().then(() => {
        startedRef.current = true;
        setNeedsClick(false);
      }).catch(() => {});
    };
    document.addEventListener("click", unlock, { once: true });
    document.addEventListener("keydown", unlock, { once: true });
    return () => {
      document.removeEventListener("click", unlock);
      document.removeEventListener("keydown", unlock);
    };
  }, [needsClick, muted]);

  const toggleMute = () => setMuted(m => !m);

  return (
    <AuthContext.Provider value={{ user, loading, refetch }}>
      <MusicContext.Provider value={{ muted, toggleMute }}>
        <audio ref={audioRef} src="/music.mp3" loop style={{ display: "none" }} />
        {needsClick && (
          <div style={{
            position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)",
            zIndex: 9999, background: "var(--bg-card)", border: "1px solid var(--accent)",
            borderRadius: 10, padding: "10px 20px", display: "flex", alignItems: "center",
            gap: 10, boxShadow: "0 8px 32px rgba(0,0,0,0.5)", pointerEvents: "none",
            animation: "pulse-bar 2s ease-in-out infinite",
          }}>
            <span style={{ fontSize: 16 }}>🎵</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
              Click anywhere to enable music
            </span>
            <style>{`@keyframes pulse-bar { 0%,100%{opacity:1} 50%{opacity:0.6} }`}</style>
          </div>
        )}
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/servers" element={<RequireAuth><GuildSelect /></RequireAuth>} />
            <Route path="/apply/:guildId/:formId" element={<Apply />} />
            <Route path="/docs" element={<Docs />} />
            <Route path="/docs/:pageId" element={<Docs />} />
            <Route path="/dashboard/:guildId" element={<RequireAuth><DashboardLayout /></RequireAuth>}>
              <Route index element={<Overview />} />
              <Route path="config" element={<YamlConfig />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </MusicContext.Provider>
    </AuthContext.Provider>
  );
}
