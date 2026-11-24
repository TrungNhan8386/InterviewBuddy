"""Small diagram helper (matplotlib) in the style of the SAD v1.1 figures."""
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.patches import Rectangle, Polygon, FancyArrowPatch

INK = '#1f2937'
MUTED = '#6b7280'
BLUE = '#dbeafe'
GREEN = '#dcfce7'
YELLOW = '#fef3c7'
GREY = '#f3f4f6'
WHITE = '#ffffff'
NEW = '#1d4ed8'
MONO = 'DejaVu Sans Mono'
SANS = 'DejaVu Sans'
LINE = 19


class Box:
    def __init__(self, x, y, w, h):
        self.x, self.y, self.w, self.h = x, y, w, h

    def top(self, f=0.5): return (self.x + self.w * f, self.y)
    def bottom(self, f=0.5): return (self.x + self.w * f, self.y + self.h)
    def left(self, f=0.5): return (self.x, self.y + self.h * f)
    def right(self, f=0.5): return (self.x + self.w, self.y + self.h * f)


class Diagram:
    def __init__(self, W, H):
        self.W, self.H = W, H
        self.fig = plt.figure(figsize=(W / 100, H / 100), dpi=100)
        ax = self.fig.add_axes([0, 0, 1, 1])
        ax.set_xlim(0, W)
        ax.set_ylim(H, 0)
        ax.axis('off')
        self.ax = ax

    def text(self, x, y, s, size=10, color=INK, weight='normal', family=SANS, ha='left', va='top', **kw):
        self.ax.text(x, y, s, fontsize=size, color=color, fontweight=weight, family=family, ha=ha, va=va, **kw)

    def cls(self, x, y, w, name, stereo=None, attrs=(), ops=(), fill=BLUE, dashed=False, star=False, empty_attr=True):
        head = 54 if stereo else 38
        comps = [c for c in (attrs, ops) if c or empty_attr]
        hs = [max(16, 10 + len(c) * LINE) for c in comps]
        h = head + sum(hs)
        ls = (0, (5, 3)) if dashed else 'solid'
        self.ax.add_patch(Rectangle((x, y), w, h, facecolor=WHITE, edgecolor=INK, lw=1.4, ls=ls))
        self.ax.add_patch(Rectangle((x, y), w, head, facecolor=fill, edgecolor=INK, lw=1.4, ls=ls))
        cy = y + 8
        if stereo:
            self.text(x + w / 2, cy, f'«{stereo}»', size=9, color=MUTED, ha='center')
            cy += 17
        self.text(x + w / 2, cy, name + (' *' if star else ''), size=12.5, weight='bold', ha='center')
        cy = y + head
        for c, hh in zip(comps, hs):
            self.ax.plot([x, x + w], [cy, cy], color=INK, lw=1.1, ls=ls)
            for i, line in enumerate(c):
                self.text(x + 10, cy + 6 + i * LINE, line, size=9.6, family=MONO)
            cy += hh
        return Box(x, y, w, h)

    def arrow(self, pts, dashed=True, head='open', label=None, lpos=None, lha='left', color=INK):
        ls = (0, (5, 3)) if dashed else 'solid'
        xs, ys = zip(*pts)
        self.ax.plot(xs[:-1] + (xs[-1],), ys, color=color, lw=1.4, ls=ls, solid_capstyle='butt')
        (x1, y1), (x2, y2) = pts[-2], pts[-1]
        if head == 'open':
            self.ax.add_patch(FancyArrowPatch((x1, y1), (x2, y2), arrowstyle='-|>', mutation_scale=16, color=color, lw=0, shrinkA=0, shrinkB=0))
        elif head == 'hollow':
            self.ax.add_patch(FancyArrowPatch((x1, y1), (x2, y2), arrowstyle='-|>', mutation_scale=20, facecolor=WHITE, edgecolor=color, lw=1.4, shrinkA=0, shrinkB=0))
        elif head == 'diamond':
            import math
            ang = math.atan2(y2 - y1, x2 - x1)
            L, Wd = 18, 7
            bx, by = x2 - L * math.cos(ang), y2 - L * math.sin(ang)
            mx, my = x2 - L / 2 * math.cos(ang), y2 - L / 2 * math.sin(ang)
            px, py = -math.sin(ang) * Wd, math.cos(ang) * Wd
            self.ax.add_patch(Polygon([(x2, y2), (mx + px, my + py), (bx, by), (mx - px, my - py)], closed=True, facecolor=INK, edgecolor=INK))
        if head == 'both':
            for a, b in ((pts[1], pts[0]), (pts[-2], pts[-1])):
                self.ax.add_patch(FancyArrowPatch(a, b, arrowstyle='-|>', mutation_scale=16, color=color, lw=0, shrinkA=0, shrinkB=0))
        if label:
            lx, ly = lpos or ((x1 + x2) / 2 + 6, (y1 + y2) / 2 - 8)
            self.text(lx, ly, label, size=9.5, color=MUTED, ha=lha, va='center',
                      bbox=dict(facecolor=WHITE, edgecolor='none', pad=1.5))

    def note(self, s, x=None, y=None):
        self.text(x if x is not None else self.W - 16, y if y is not None else self.H - 12, s, size=9.5, color=MUTED, ha='right', va='bottom')

    def node3d(self, x, y, w, h, name, stereo, fill=GREY, d=14, lines=(), title_size=13):
        """UML node: a box with a 3D top and right side."""
        self.ax.add_patch(Polygon([(x, y), (x + d, y - d), (x + w + d, y - d), (x + w, y)], closed=True, facecolor=fill, edgecolor=INK, lw=1.4))
        self.ax.add_patch(Polygon([(x + w, y), (x + w + d, y - d), (x + w + d, y + h - d), (x + w, y + h)], closed=True, facecolor=fill, edgecolor=INK, lw=1.4))
        self.ax.add_patch(Rectangle((x, y), w, h, facecolor=fill, edgecolor=INK, lw=1.4))
        self.text(x + 12, y + 8, f'«{stereo}»', size=9, color=MUTED)
        self.text(x + 12, y + 24, name, size=title_size, weight='bold')
        for i, line in enumerate(lines):
            self.text(x + 12, y + 52 + i * LINE, line, size=9.6)
        return Box(x, y, w, h)

    def artifact(self, x, y, w, name, lines=(), stereo='artifact', fill=WHITE):
        h = 46 + len(lines) * LINE + (6 if lines else 0)
        self.ax.add_patch(Rectangle((x, y), w, h, facecolor=fill, edgecolor=INK, lw=1.2))
        # document icon
        ix, iy = x + w - 24, y + 8
        self.ax.add_patch(Polygon([(ix, iy), (ix + 10, iy), (ix + 14, iy + 4), (ix + 14, iy + 18), (ix, iy + 18)], closed=True, facecolor=WHITE, edgecolor=INK, lw=1))
        self.text(x + 10, y + 7, f'«{stereo}»', size=8.5, color=MUTED)
        self.text(x + 10, y + 22, name, size=10.5, weight='bold')
        for i, line in enumerate(lines):
            self.text(x + 10, y + 46 + i * LINE, line, size=9.2, family=MONO)
        return Box(x, y, w, h)

    def save(self, path):
        self.fig.savefig(path, dpi=100, facecolor='white')
        plt.close(self.fig)
