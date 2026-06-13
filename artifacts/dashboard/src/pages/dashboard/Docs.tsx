export default function Docs() {
  return (
    <div style={{ padding: "36px 32px", maxWidth: 860 }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, color: "var(--text-primary)", marginBottom: 8 }}>
        Documentation
      </h1>
      <p style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 40, lineHeight: 1.6 }}>
        NightPigeon is configured entirely through a single YAML file per server.
        Edit it in the <b>Config</b> tab or via the <code style={code}>{">"}</code>config Discord command.
        Changes apply within seconds — no restart needed.
      </p>

      <Section title="Bot Command">
        <p>NightPigeon has one command:</p>
        <Pre>{`>config               — downloads current config as a .yaml file
>config (+ .yaml file) — uploads and applies new config`}</Pre>
        <p>Requires <b>Administrator</b> permission.</p>
      </Section>

      <Section title="Top-level keys">
        <Table rows={[
          ["prefix", `string`, `">"`, "Command prefix for the bot"],
          ["levels", "object", "—", "Permission level assignments for users, roles, and commands"],
          ["tags", "object", "—", "Custom text responses triggered by tag name"],
          ["plugins", "object", "—", "Plugin-specific configuration blocks"],
        ]} />
      </Section>

      <Section title="levels">
        <p>Controls who can use which commands. Each command has a required level (0–100). Assign levels to users or roles to grant access.</p>
        <Pre>{`levels:
  users:
    "123456789012345678": 100   # user ID → level
  roles:
    "987654321098765432": 50    # role ID → level
  commands:
    ban: 50        # override default level for a command
    kick: 25`}</Pre>
        <p style={{ color: "var(--text-secondary)", fontSize: 13, marginTop: 8 }}>
          Level 0 = everyone · Level 100 = bot owner only. Default levels are set per-command automatically.
        </p>
      </Section>

      <Section title="tags">
        <p>Simple key → text responses. Anyone can trigger a tag with <code style={code}>{">tagname"}</code>.</p>
        <Pre>{`tags:
  rules: "Please read #rules before chatting."
  invite: "https://discord.gg/yourserver"
  hello: "Hey {user}, welcome!"`}</Pre>
      </Section>

      <Section title="plugins">
        <p>Plugin config blocks live under <code style={code}>plugins:</code>. Each plugin has a <code style={code}>config:</code> sub-key.</p>

        <SubSection title="command_aliases">
          <Pre>{`plugins:
  command_aliases:
    config:
      aliases:
        b: ban
        k: kick
        m: mute`}</Pre>
        </SubSection>

        <SubSection title="preset_reasons">
          <Pre>{`plugins:
  preset_reasons:
    config:
      presets:
        spam: "Spamming in chat"
        toxic: "Toxic behavior"`}</Pre>
          <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>
            Use preset names as reasons in moderation commands, e.g. <code style={code}>{">ban @user spam"}</code>
          </p>
        </SubSection>

        <SubSection title="moderation">
          <Pre>{`plugins:
  moderation:
    enabled: true
    mute_role: null          # role ID or null for Discord timeout
    dm_on_action: true       # DM the user when a mod action is taken
    messages:
      ban_success: "{user} has been banned | Case: {case_id}"
      kick_success: "{user} has been kicked | Case: {case_id}"
      mute_success: "{user} has been muted | Duration: {duration}"
      warn_success: "{user} has been warned | Case: {case_id}"`}</Pre>
        </SubSection>
      </Section>

      <Section title="Template variables">
        <Table rows={[
          ["{user}", "The target user's mention (@User)"],
          ["{user_tag}", "The target user's tag (User#0000)"],
          ["{moderator}", "The moderator's mention"],
          ["{case_id}", "The case number"],
          ["{duration}", "Formatted duration (e.g. 1h 30m)"],
          ["{reason}", "The reason provided"],
          ["{count}", "Generic count (purge, slowmode)"],
          ["{channel}", "Channel mention"],
        ]} />
      </Section>

      <Section title="Full example config">
        <Pre>{`prefix: ">"

levels:
  users: {}
  roles:
    "MOD_ROLE_ID_HERE": 50
    "ADMIN_ROLE_ID_HERE": 100
  commands: {}

tags:
  rules: "Read <#RULES_CHANNEL_ID> before chatting!"
  invite: "https://discord.gg/yourserver"

plugins:
  command_aliases:
    config:
      aliases:
        b: ban
        k: kick
        m: mute
        w: warn
        p: purge

  preset_reasons:
    config:
      presets:
        spam: "Spamming in chat"
        toxic: "Toxic behavior"
        ads: "Advertising without permission"

  moderation:
    enabled: true
    mute_role: null
    dm_on_action: true`}</Pre>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 40 }}>
      <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", marginBottom: 12, paddingBottom: 8, borderBottom: "1px solid var(--border)" }}>
        {title}
      </h2>
      <div style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.7, display: "flex", flexDirection: "column", gap: 10 }}>
        {children}
      </div>
    </section>
  );
}

function SubSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", marginBottom: 8, fontFamily: "monospace" }}>{title}</div>
      {children}
    </div>
  );
}

function Pre({ children }: { children: string }) {
  return (
    <pre style={{
      background: "var(--yaml-bg)", border: "1px solid var(--border)", borderRadius: 6,
      padding: "14px 16px", fontFamily: "'JetBrains Mono','Fira Code',Consolas,monospace",
      fontSize: 12, color: "var(--text-primary)", overflowX: "auto", lineHeight: 1.65,
      margin: 0,
    }}>
      {children}
    </pre>
  );
}

const code: React.CSSProperties = {
  background: "var(--bg-card)", padding: "1px 6px", borderRadius: 4,
  fontFamily: "monospace", fontSize: 12, color: "var(--accent)",
};

function Table({ rows }: { rows: string[][] }) {
  const isThreeCol = rows[0]?.length === 3;
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
      <thead>
        <tr style={{ borderBottom: "1px solid var(--border)" }}>
          <th style={th}>Key</th>
          {!isThreeCol && <th style={th}>Type</th>}
          {!isThreeCol && <th style={th}>Default</th>}
          <th style={th}>Description</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i} style={{ borderBottom: "1px solid var(--border)" }}>
            {row.map((cell, j) => (
              <td key={j} style={{ ...tdStyle, ...(j === 0 ? { fontFamily: "monospace", color: "var(--accent)", fontWeight: 600 } : {}) }}>
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

const th: React.CSSProperties = { textAlign: "left", padding: "6px 12px", color: "var(--text-muted)", fontWeight: 600, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em" };
const tdStyle: React.CSSProperties = { padding: "8px 12px", color: "var(--text-secondary)", verticalAlign: "top" };
