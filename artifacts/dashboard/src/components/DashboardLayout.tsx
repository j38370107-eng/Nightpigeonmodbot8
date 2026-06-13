import { useEffect, useState, useCallback } from "react";
import { Outlet, useParams, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../App";
import { api } from "../lib/api";
import { Shield } from "lucide-react";

const INVITE_URL = "https://discord.com/oauth2/authorize?client_id=1507550967275458660&permissions=6293600228863223&integration_type=0&scope=bot";

export default function DashboardLayout() {
  const { guildId } = useParams<{ guildId: string }>();
  const { user, refetch } = useAuth();
  const navigate = useNavigate();
  const [guild, setGuild] = useState<any>(null);
  const [botChecked, setBotChecked] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);

  useEffect(() => {
    api.auth.guilds().then((guilds) => {
      const g = guilds.find((g: any) => g.id === guildId);
      if (!g) setAccessDenied(true);
      else setGuild(g);
    }).catch(() => {});
  }, [guildId]);

  useEffect(() => {
    if (!guildId) return;
    api.guild.botStatus(guildId).then(({ present }) => {
      if (!present) {
        window.location.href = `${INVITE_URL}&guild_id=${guildId}&disable_guild_select=true`;
      } else {
        setBotChecked(true);
      }
    }).catch(() => setBotChecked(true));
  }, [guildId]);

  const handleLogout = useCallback(async () => {
    await api.auth.logout();
    refetch();
    navigate("/");
  }, [refetch, navigate]);

  if (accessDenied) {
    return (
      <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"100vh", flexDirection:"column", gap:16, padding:24 }}>
        <Shield size={48} color="var(--danger)" style={{ opacity:0.7 }} />
        <div style={{ textAlign:"center" }}>
          <div style={{ fontSize:18, fontWeight:700, color:"var(--text-primary)", marginBottom:8 }}>Access Denied</div>
          <div style={{ fontSize:14, color:"var(--text-secondary)", maxWidth:360 }}>
            You don't have <strong>Manage Server</strong> permission in this server, or your session is out of date.
          </div>
        </div>
        <div style={{ display:"flex", gap:10 }}>
          <button onClick={() => navigate("/servers")} style={{ padding:"9px 20px", background:"var(--accent)", border:"none", borderRadius:6, color:"#000", fontWeight:600, fontSize:13, cursor:"pointer", fontFamily:"inherit" }}>
            Back to Servers
          </button>
          <button onClick={() => window.location.href = "/api/auth/login"} style={{ padding:"9px 20px", background:"var(--bg-card)", border:"1px solid var(--border)", borderRadius:6, color:"var(--text-primary)", fontWeight:600, fontSize:13, cursor:"pointer", fontFamily:"inherit" }}>
            Re-authenticate
          </button>
        </div>
      </div>
    );
  }

  if (!botChecked) {
    return (
      <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"100vh", color:"var(--text-muted)", fontSize:14 }}>
        Checking bot status…
      </div>
    );
  }

  const guildIconUrl = guild?.icon ? `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png` : null;

  return (
    <div className="dash-root">
      <header className="dash-nav">
        <span className="dash-nav-brand">NightPigeon Dashboard</span>

        {guildIconUrl
          ? <img src={guildIconUrl} alt="" style={{ width:22, height:22, borderRadius:4 }} />
          : <div style={{ width:22, height:22, borderRadius:4, background:"var(--bg-card)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:700, color:"var(--text-muted)" }}>
              {guild?.name?.[0] ?? "?"}
            </div>
        }
        <span style={{ fontSize:14, color:"var(--text-secondary)", fontWeight:500, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", maxWidth:200 }}>
          {guild?.name ?? "…"}
        </span>

        <div className="dash-nav-links">
          <NavLink to="" end className={({ isActive }) => `dash-nav-link${isActive ? " active" : ""}`}>Overview</NavLink>
          <NavLink to="config" className={({ isActive }) => `dash-nav-link${isActive ? " active" : ""}`}>Config</NavLink>
          <button className="dash-nav-link" onClick={() => navigate("/servers")}>Guilds</button>
          <button className="dash-nav-link" onClick={handleLogout}>Log out</button>
        </div>
      </header>

      <main className="dash-main">
        <Outlet />
      </main>
    </div>
  );
}
