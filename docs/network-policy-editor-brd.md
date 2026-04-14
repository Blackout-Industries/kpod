# Kubernetes Network Policy Editor — Offline Edition

## Business Requirements Document

**Project:** Offline Network Policy Editor for Kubernetes
**Reference:** [editor.networkpolicy.io](https://editor.networkpolicy.io) by Isovalent/Cilium
**Target Stack:** Single-file React application (`.jsx` or `.html`), zero backend, fully offline
**Audience:** Claude Code implementation

---

## 1. Executive Summary

Build an offline, single-file, browser-based visual editor for Kubernetes Network Policies. The tool replicates the core UX of `editor.networkpolicy.io` — a three-column visual canvas showing **Ingress Sources → Target Pod → Egress Destinations**, with a live-synced YAML editor panel below. The user should be able to visually construct, edit, and export Kubernetes `NetworkPolicy` and optionally `CiliumNetworkPolicy` YAML without any network connectivity.

---

## 2. Layout & UI Structure

### 2.1 Overall Layout

The app has **two major regions** stacked vertically:

| Region | Position | Content |
|--------|----------|---------|
| **Visual Canvas** | Top ~60% | Three-column node-and-arrow diagram |
| **YAML Panel** | Bottom ~40% | Tabbed code editor + action buttons |

A **draggable divider** between them allows resizing.

### 2.2 Visual Canvas (Top Region)

Three columns, horizontally arranged:

```
┌─────────────────┐      ┌──────────────┐      ┌─────────────────┐
│  INGRESS SOURCES │ ───► │  TARGET POD  │ ───► │ EGRESS TARGETS  │
│  (left column)   │      │  (center)    │      │ (right column)  │
└─────────────────┘      └──────────────┘      └─────────────────┘
```

#### 2.2.1 Target Pod (Center Node)

- Displays the **namespace label** (editable text, default: `"In Namespace"`)
- Shows an **edit (pencil) icon** to open pod selector configuration
- Shows two **badge indicators** at the bottom:
  - **Ingress badge** — green "Default Allow" or red "Default Deny"
  - **Egress badge** — green "Default Allow" or red "Default Deny"
- The default posture changes automatically based on whether ingress/egress rules exist:
  - If any ingress rule is defined → Ingress becomes "Default Deny" (red) for unmatched traffic
  - If no ingress rules → Ingress is "Default Allow" (green)
  - Same logic for egress

**Pod Selector Configuration (modal/panel on click):**

| Field | Type | Description |
|-------|------|-------------|
| Namespace | Text input | Namespace the policy applies to (metadata.namespace) |
| Pod Selector Labels | Key-value pairs (add/remove) | matchLabels for spec.podSelector |
| Empty selector `{}` | Checkbox/toggle | Selects all pods in namespace |

#### 2.2.2 Ingress Source Nodes (Left Column)

Each ingress source is a **card** with a `+` button to add more. Three source types:

##### a) Outside Cluster
- Icon: globe/cloud
- Fields:
  - **IP CIDR blocks** — list of CIDR strings (e.g., `10.0.0.0/8`)
  - **Except CIDRs** — list of exception CIDRs
  - **Ports** — list of port + protocol (TCP/UDP/SCTP)
- Displays summary: `"Any endpoint"` or the configured CIDRs

##### b) In Namespace
- Icon: curly braces `{}`
- Fields:
  - **Namespace selector labels** — key-value matchLabels for namespaceSelector
  - **Pod selector labels** — key-value matchLabels for podSelector within that namespace
  - **Ports** — list of port + protocol
- Displays summary: `"Any pod"` or label summary

##### c) In Cluster
- Icon: Kubernetes cluster icon
- Fields:
  - **Pod selector labels** — matchLabels (same namespace)
  - **Ports** — list of port + protocol
- Displays summary: `"Everything in the cluster"` or label summary

Each card shows **green arrows** (→) pointing to the center Target Pod, indicating allowed ingress.

#### 2.2.3 Egress Destination Nodes (Right Column)

Mirror of ingress sources. Same three types:

##### a) Outside Cluster
- Same fields as ingress Outside Cluster
- Displays: `"Any endpoint"` or configured CIDRs

##### b) In Namespace
- Same fields as ingress In Namespace

##### c) In Cluster
- Same fields as ingress In Cluster
- **Additional built-in option:** "Kubernetes DNS" — pre-configured egress rule allowing DNS on port 53/UDP to kube-system kube-dns. This is extremely common and should be a one-click add.

Each card shows **arrows** from center Target Pod (→) to the egress card:
- **Green arrow** = explicitly allowed
- **Red arrow** = denied (default deny applies, no matching rule)

#### 2.2.4 Arrow Rendering

- Arrows are drawn as **SVG paths or lines** connecting source cards to the center node and center node to destination cards
- Arrow color:
  - **Green (#22c55e or similar)** — traffic allowed by rule
  - **Red (#ef4444 or similar)** — traffic denied (shown for "default deny" indicator)
- Arrows should **curve slightly** for visual clarity (use bezier curves)
- Arrow direction indicated with arrowheads

### 2.3 YAML Panel (Bottom Region)

#### 2.3.1 Tab Bar

Two tabs at the top of the YAML panel:

| Tab | Description |
|-----|-------------|
| **Kubernetes Network Policy** | Standard `networking.k8s.io/v1` NetworkPolicy |
| **Cilium Network Policy** | `cilium.io/v2` CiliumNetworkPolicy |

Switching tabs regenerates the YAML in the corresponding format. Both should represent the same visual policy.

#### 2.3.2 YAML Editor

- **Syntax-highlighted** YAML code editor (use a monospace font, highlight keys vs values)
- **Line numbers** on the left gutter
- **Editable** — changes in the YAML should parse and update the visual canvas (bidirectional sync)
- If YAML is invalid, show an inline error indicator without crashing

#### 2.3.3 Action Bar

Buttons next to the tabs:

| Button | Action |
|--------|--------|
| **Copy** (clipboard icon) | Copy YAML to clipboard |
| **Download** | Download YAML as `.yaml` file |
| **Upload / Import** | Load existing YAML file and parse into visual editor |
| **Policy Rating** | Visual indicator (1-4 bars) rating the policy's security posture |

#### 2.3.4 Policy Rating Logic

Rate the security posture based on:

| Rating | Criteria |
|--------|----------|
| 1 bar (weak) | No ingress or egress rules defined (allow-all) |
| 2 bars | Only ingress OR only egress defined |
| 3 bars | Both ingress and egress defined but broad selectors |
| 4 bars (strong) | Both ingress and egress defined with specific selectors and ports |

---

## 3. Data Model

### 3.1 Internal State

The application maintains a single source-of-truth state object:

```typescript
interface PolicyState {
  // Metadata
  policyName: string;           // metadata.name
  namespace: string;            // metadata.namespace

  // Pod Selector
  podSelector: Record<string, string>;  // matchLabels, empty = select all

  // Ingress Rules
  ingressRules: IngressRule[];

  // Egress Rules
  egressRules: EgressRule[];
}

interface IngressRule {
  id: string;                    // unique ID for UI
  type: 'outside' | 'namespace' | 'cluster';

  // For 'outside' (ipBlock)
  cidr?: string;
  except?: string[];

  // For 'namespace'
  namespaceSelector?: Record<string, string>;

  // For 'namespace' and 'cluster'
  podSelector?: Record<string, string>;

  // Common
  ports: PortRule[];
}

interface EgressRule {
  id: string;
  type: 'outside' | 'namespace' | 'cluster';
  // Same fields as IngressRule
  cidr?: string;
  except?: string[];
  namespaceSelector?: Record<string, string>;
  podSelector?: Record<string, string>;
  ports: PortRule[];
}

interface PortRule {
  port: number | string;        // port number or name
  protocol: 'TCP' | 'UDP' | 'SCTP';
}
```

### 3.2 YAML Generation

#### Kubernetes NetworkPolicy

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: <policyName>
  namespace: <namespace>
spec:
  podSelector:
    matchLabels:
      <key>: <value>
  policyTypes:
    - Ingress    # if any ingress rules exist
    - Egress     # if any egress rules exist
  ingress:
    - from:
        - ipBlock:            # type = outside
            cidr: <cidr>
            except: [<cidrs>]
        - namespaceSelector:  # type = namespace
            matchLabels: ...
          podSelector:
            matchLabels: ...
        - podSelector:        # type = cluster
            matchLabels: ...
      ports:
        - port: <port>
          protocol: <protocol>
  egress:
    - to:
        - <same structure as ingress from>
      ports:
        - <same structure>
```

#### CiliumNetworkPolicy

```yaml
apiVersion: cilium.io/v2
kind: CiliumNetworkPolicy
metadata:
  name: <policyName>
  namespace: <namespace>
spec:
  endpointSelector:
    matchLabels:
      <key>: <value>
  ingress:
    - fromEndpoints:
        - matchLabels:
            <key>: <value>
      fromCIDR:
        - <cidr>
      toPorts:
        - ports:
            - port: "<port>"
              protocol: <protocol>
  egress:
    - toEndpoints:
        - matchLabels:
            <key>: <value>
      toCIDR:
        - <cidr>
      toPorts:
        - ports:
            - port: "<port>"
              protocol: <protocol>
```

**Cilium DNS egress special case:**
When the user adds the "Kubernetes DNS" shortcut, generate:

```yaml
egress:
  - toEndpoints:
      - matchLabels:
          io.kubernetes.pod.namespace: kube-system
          k8s-app: kube-dns
    toPorts:
      - ports:
          - port: "53"
            protocol: UDP
        rules:
          dns:
            - matchPattern: "*"
```

---

## 4. Interactions & Behavior

### 4.1 Adding Rules

- Click `+` button on any source/destination card heading to add a new rule of that type
- New cards appear in the respective column with default empty values
- An arrow is immediately drawn to/from the center node

### 4.2 Editing Rules

- Click on any card to open an **inline edit panel or modal** with fields for that rule type
- Label pairs use a dynamic list UI with `+ Add Label` button
- Port rules use a dynamic list with port number input + protocol dropdown

### 4.3 Removing Rules

- Each card has a **delete/remove button** (×) to remove that rule
- Removing all rules of a direction resets that direction to "Default Allow"

### 4.4 Bidirectional Sync

- **Visual → YAML:** Any change in the visual canvas immediately regenerates the YAML below
- **YAML → Visual:** Editing the YAML and pressing a "Parse" button (or on-blur/debounce) updates the visual canvas
- Invalid YAML shows an error banner but does not destroy the visual state

### 4.5 Import Flow

1. User clicks "Upload" / "Import"
2. File picker opens for `.yaml` / `.yml` files
3. App parses the YAML
4. Detects if it's `NetworkPolicy` or `CiliumNetworkPolicy` (based on `apiVersion`/`kind`)
5. Populates the visual canvas and selects the correct tab

### 4.6 Export / Download

- Downloads the currently displayed YAML as a `.yaml` file
- Filename: `<policyName>.yaml` (sanitized)

---

## 5. Visual Design Guidelines

### 5.1 Color Palette

| Element | Color |
|---------|-------|
| Background canvas | Light gray `#f8fafc` |
| Card background | White `#ffffff` with subtle shadow |
| Card border | `#e2e8f0` |
| Allowed arrow | Green `#22c55e` |
| Denied arrow / badge | Red `#ef4444` |
| Primary accent | Blue `#3b82f6` |
| YAML panel background | Dark `#1e293b` or white depending on theme |
| Text primary | `#1e293b` |
| Text secondary | `#64748b` |

### 5.2 Typography

- Card titles: 14px semibold
- Card body text: 13px regular
- YAML editor: 13px monospace (e.g., `JetBrains Mono`, `Fira Code`, or `monospace`)
- Buttons: 13px medium

### 5.3 Card Design

Each card:
- Rounded corners (8px)
- Light shadow (`0 1px 3px rgba(0,0,0,0.1)`)
- Icon on the left of the title
- `+` button on the right of the title
- Content area with summary text
- Min width: ~220px

### 5.4 Icons

Use inline SVG or Lucide icons for:
- Globe (Outside Cluster)
- Curly braces (In Namespace)
- Kubernetes-style cluster icon (In Cluster)
- Pencil (Edit)
- Plus (Add)
- Download
- Copy
- Trash/X (Remove)

---

## 6. Technical Requirements

### 6.1 Constraints

| Constraint | Requirement |
|------------|-------------|
| Single file | Everything in one `.html` or `.jsx` file |
| No backend | Zero API calls, no server needed |
| No build step | Works by opening in a browser directly (if HTML) or via React artifact renderer |
| Offline | All functionality works without internet |
| YAML parsing | Must handle parsing and generating valid YAML in-browser |
| Responsive | Usable on 1280px+ screens (desktop-first, not mobile) |

### 6.2 Recommended Libraries (if React `.jsx`)

| Library | Purpose |
|---------|---------|
| React (built-in) | UI framework |
| Tailwind (built-in utility classes) | Styling |
| `js-yaml` via CDN | YAML parse/stringify — **OR** write a minimal YAML serializer |
| Lucide React | Icons |

> **Note:** If using a single HTML file, bundle everything inline. If using React artifact, the available libs are: React, Tailwind, Lucide React, Recharts, D3, lodash, etc.

### 6.3 State Management

- Use React `useReducer` for the central policy state
- Actions: `ADD_INGRESS_RULE`, `REMOVE_INGRESS_RULE`, `UPDATE_INGRESS_RULE`, `ADD_EGRESS_RULE`, `REMOVE_EGRESS_RULE`, `UPDATE_EGRESS_RULE`, `SET_POD_SELECTOR`, `SET_METADATA`, `IMPORT_YAML`, etc.
- Derive YAML output from state (computed, not stored separately)

---

## 7. Scope & Priorities

### 7.1 Must Have (P0)

- [ ] Three-column visual canvas with cards for ingress sources, target pod, egress destinations
- [ ] Support for all three source/destination types: Outside Cluster, In Namespace, In Cluster
- [ ] Pod selector editing on the center node
- [ ] Label-based selectors (key-value pairs) with add/remove UI
- [ ] Port rules (port number + protocol) with add/remove UI
- [ ] CIDR input for ipBlock rules
- [ ] Live YAML generation (Kubernetes NetworkPolicy format)
- [ ] YAML download as `.yaml` file
- [ ] YAML copy to clipboard
- [ ] Arrow visualization between nodes
- [ ] Default Allow / Default Deny badges on center node
- [ ] YAML import from file upload

### 7.2 Should Have (P1)

- [ ] CiliumNetworkPolicy tab with correct YAML format
- [ ] Bidirectional sync (editing YAML updates visual)
- [ ] Kubernetes DNS shortcut button for egress
- [ ] Policy rating indicator
- [ ] Syntax-highlighted YAML display

### 7.3 Nice to Have (P2)

- [ ] Dark mode toggle
- [ ] Undo/redo
- [ ] Multiple policies in one session
- [ ] Export as JSON
- [ ] Animated arrows
- [ ] Tutorial / walkthrough panel (like the original editor's right sidebar)

---

## 8. Acceptance Criteria

1. **Open the file in a browser** → loads immediately, no network requests
2. **Add an ingress rule** (e.g., In Namespace with label `app: frontend`) → card appears, arrow drawn, YAML updates
3. **Add an egress rule** (e.g., In Cluster + Kubernetes DNS) → card appears, YAML includes DNS rule
4. **Edit pod selector** on center node → YAML `podSelector.matchLabels` updates
5. **Download YAML** → valid Kubernetes NetworkPolicy that passes `kubectl apply --dry-run=client`
6. **Upload existing YAML** → visual canvas populates correctly
7. **Switch between K8s and Cilium tabs** → YAML regenerates in the correct format
8. **All interactions are instant** — no loading spinners, no API calls
