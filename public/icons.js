import createElement from "/vendor/lucide/createElement.js";
import Activity from "/vendor/lucide/icons/activity.js";
import ArrowLeft from "/vendor/lucide/icons/arrow-left.js";
import ArrowRight from "/vendor/lucide/icons/arrow-right.js";
import BadgeCheck from "/vendor/lucide/icons/badge-check.js";
import BarChart3 from "/vendor/lucide/icons/chart-no-axes-column-increasing.js";
import Bell from "/vendor/lucide/icons/bell.js";
import Bot from "/vendor/lucide/icons/bot.js";
import BriefcaseBusiness from "/vendor/lucide/icons/briefcase-business.js";
import Check from "/vendor/lucide/icons/check.js";
import CheckCircle2 from "/vendor/lucide/icons/circle-check-big.js";
import ChevronDown from "/vendor/lucide/icons/chevron-down.js";
import CircleAlert from "/vendor/lucide/icons/circle-alert.js";
import CircleHelp from "/vendor/lucide/icons/circle-help.js";
import ClipboardCheck from "/vendor/lucide/icons/clipboard-check.js";
import Clock3 from "/vendor/lucide/icons/clock-3.js";
import Copy from "/vendor/lucide/icons/copy.js";
import Download from "/vendor/lucide/icons/download.js";
import ExternalLink from "/vendor/lucide/icons/external-link.js";
import FileText from "/vendor/lucide/icons/file-text.js";
import Filter from "/vendor/lucide/icons/list-filter.js";
import Gauge from "/vendor/lucide/icons/gauge.js";
import History from "/vendor/lucide/icons/history.js";
import Inbox from "/vendor/lucide/icons/inbox.js";
import LayoutDashboard from "/vendor/lucide/icons/layout-dashboard.js";
import Link2 from "/vendor/lucide/icons/link-2.js";
import LockKeyhole from "/vendor/lucide/icons/lock-keyhole.js";
import LogOut from "/vendor/lucide/icons/log-out.js";
import Mail from "/vendor/lucide/icons/mail.js";
import Menu from "/vendor/lucide/icons/menu.js";
import Moon from "/vendor/lucide/icons/moon.js";
import MoreHorizontal from "/vendor/lucide/icons/ellipsis.js";
import Play from "/vendor/lucide/icons/play.js";
import Plus from "/vendor/lucide/icons/plus.js";
import RefreshCw from "/vendor/lucide/icons/refresh-cw.js";
import RotateCcw from "/vendor/lucide/icons/rotate-ccw.js";
import Save from "/vendor/lucide/icons/save.js";
import Search from "/vendor/lucide/icons/search.js";
import Settings2 from "/vendor/lucide/icons/settings-2.js";
import ShieldCheck from "/vendor/lucide/icons/shield-check.js";
import SlidersHorizontal from "/vendor/lucide/icons/sliders-horizontal.js";
import Sparkles from "/vendor/lucide/icons/sparkles.js";
import Sun from "/vendor/lucide/icons/sun.js";
import Trash2 from "/vendor/lucide/icons/trash-2.js";
import TrendingUp from "/vendor/lucide/icons/trending-up.js";
import Upload from "/vendor/lucide/icons/upload.js";
import UserRound from "/vendor/lucide/icons/user-round.js";
import UsersRound from "/vendor/lucide/icons/users-round.js";
import WandSparkles from "/vendor/lucide/icons/wand-sparkles.js";
import X from "/vendor/lucide/icons/x.js";

const icons = {
  activity: Activity,
  "arrow-left": ArrowLeft,
  "arrow-right": ArrowRight,
  "badge-check": BadgeCheck,
  "bar-chart-3": BarChart3,
  bell: Bell,
  bot: Bot,
  briefcase: BriefcaseBusiness,
  check: Check,
  "check-circle": CheckCircle2,
  "chevron-down": ChevronDown,
  "circle-alert": CircleAlert,
  "circle-help": CircleHelp,
  "clipboard-check": ClipboardCheck,
  clock: Clock3,
  copy: Copy,
  download: Download,
  "external-link": ExternalLink,
  "file-text": FileText,
  filter: Filter,
  gauge: Gauge,
  history: History,
  inbox: Inbox,
  dashboard: LayoutDashboard,
  link: Link2,
  lock: LockKeyhole,
  logout: LogOut,
  mail: Mail,
  menu: Menu,
  moon: Moon,
  more: MoreHorizontal,
  play: Play,
  plus: Plus,
  refresh: RefreshCw,
  retry: RotateCcw,
  save: Save,
  search: Search,
  settings: Settings2,
  shield: ShieldCheck,
  sliders: SlidersHorizontal,
  sparkles: Sparkles,
  sun: Sun,
  trash: Trash2,
  trend: TrendingUp,
  upload: Upload,
  user: UserRound,
  users: UsersRound,
  wand: WandSparkles,
  x: X
};

window.apiceRenderIcons = (root = document) => {
  root.querySelectorAll("[data-lucide]").forEach((placeholder) => {
    const name = placeholder.getAttribute("data-lucide");
    const node = icons[name];
    if (!node) return;
    const svg = createElement(node);
    for (const attribute of placeholder.attributes) {
      if (attribute.name !== "data-lucide") svg.setAttribute(attribute.name, attribute.value);
    }
    svg.setAttribute("aria-hidden", "true");
    placeholder.replaceWith(svg);
  });
};

window.apiceRenderIcons();
window.dispatchEvent(new Event("apice-icons-ready"));
