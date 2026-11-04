# Adapted from the team-provided InterfaceCrossingRevised animation.
# Render: python -m manim -qm tools/animations/emulsion_transfer.py EmulsionTransferWeb
from manim import *
import numpy as np


BG = "#0C1118"

OIL = "#E8C65A"

OUTER = "#B9D9F2"

INNER = "#F56576"

HEAD = "#4A91F2"

TAIL = "#F4F4F4"

NBD = "#42D96B"

GLASS = "#DDE6F0"

DARK = "#27323D"

R_BIG = 0.48

N_SMALL = 64

R_SMALL = R_BIG / 8  # 0.06; 64 * R_SMALL**2 == R_BIG**2, so red area is conserved in 2D

def tail_len_to_scale(length):
    return length / 0.24

class EmulsionTransferWeb(MovingCameraScene):

    def construct(self):
        self.camera.background_color = BG
        self.target_center = np.array([0.0, 0.198, 0.0])
        self.interface_y_world = 0.0
        self.target_tube = self.make_tube_outline(self.target_center, scale=1.1)
        self.target_outer = self.make_outer_fill(self.target_center, scale=1.1)
        self.target_oil = self.make_top_oil_fill(self.target_center, scale=1.1)
        self.interface_lipids_small = self.make_small_interface_row(0, 0, 1.2, 15)
        rng = np.random.default_rng(42)
        self.layered_emulsions = VGroup(*[
            self.make_small_emulsion([rng.uniform(-0.55, 0.55), rng.uniform(0.12, 0.8), 0])
            for _ in range(N_SMALL)
        ])
        self.layered_emulsions[28].move_to([0, 0.18, 0])
        self.outer_text = Text('External aqueous solution', font_size=22).move_to([0, -0.7, 0])
        self.legend = VGroup(
            Text('Emulsion transfer', font_size=32, weight=BOLD),
            Text('A second lipid layer forms as the droplet crosses the interface.', font_size=20),
        ).arrange(DOWN, buff=0.18).to_edge(UP, buff=0.4)
        self.add(self.target_outer, self.target_oil, self.target_tube,
                 self.interface_lipids_small, self.layered_emulsions,
                 self.outer_text, self.legend)
        self.wait(1.2)
        self.zoom_and_cross_interface()
        self.wait(1.5)

    def make_lipid_icon(self, scale=1.0, nbd=False):
        head = Circle(
            radius=0.075 * scale,
            fill_color=HEAD,
            fill_opacity=1,
            stroke_width=0,
        )
        y0 = -0.075 * scale
        tail1 = Line(
            np.array([-0.025, y0, 0]),
            np.array([-0.07, y0 - 0.22 * scale, 0]),
            color=TAIL,
            stroke_width=3.6 * scale,
        )
        tail2 = Line(
            np.array([0.025, y0, 0]),
            np.array([0.07, y0 - 0.22 * scale, 0]),
            color=TAIL,
            stroke_width=3.6 * scale,
        )
        g = VGroup(head, tail1, tail2)
        if nbd:
            linker = Line(
                head.get_center() + RIGHT * 0.05 * scale,
                head.get_center() + RIGHT * 0.13 * scale + UP * 0.07 * scale,
                color=NBD,
                stroke_width=2.4 * scale,
            )
            marker = Circle(
                radius=0.042 * scale,
                fill_color=NBD,
                fill_opacity=1,
                stroke_width=0,
            ).move_to(linker.get_end())
            g.add(linker, marker)
        return g

    def make_lipid_at(self, head_pos, tail_dir, scale=1.0, opacity=1.0, nbd=False):
        head_pos = np.array(head_pos, dtype=float)
        v = np.array(tail_dir, dtype=float)
        v[2] = 0
        n = np.linalg.norm(v[:2])
        if n < 1e-9:
            v = UP.copy()
        else:
            v = v / n
        perp = np.array([-v[1], v[0], 0.0])

        head_r = 0.060 * scale
        tail_len = 0.24 * scale
        spread = 0.048 * scale
        base = head_pos + v * head_r * 0.25

        tail1 = Line(
            base,
            base + v * tail_len + perp * spread,
            color=TAIL,
            stroke_width=3.2 * scale,
        )
        tail2 = Line(
            base,
            base + v * tail_len - perp * spread,
            color=TAIL,
            stroke_width=3.2 * scale,
        )
        head = Circle(
            radius=head_r,
            fill_color=HEAD,
            fill_opacity=1,
            stroke_width=0,
        ).move_to(head_pos)

        g = VGroup(tail1, tail2, head)
        if nbd:
            # a small fluorescent tag; only used on a few lipids for visual reference
            marker = Circle(
                radius=0.035 * scale,
                fill_color=NBD,
                fill_opacity=1,
                stroke_width=0,
            ).move_to(head_pos + perp * 0.10 * scale)
            g.add(marker)
        g.set_opacity(opacity)
        return g

    def make_lipid_structure_key(self):
        rows = VGroup(
            VGroup(Dot(color=HEAD, radius=0.06), Text("hydrophilic head", font_size=20)).arrange(RIGHT, buff=0.12),
            VGroup(Line(ORIGIN, RIGHT * 0.15, color=TAIL, stroke_width=3), Text("hydrophobic tails", font_size=20)).arrange(RIGHT, buff=0.12),
            VGroup(Dot(color=NBD, radius=0.05), Text("NBD label", font_size=20)).arrange(RIGHT, buff=0.12),
        ).arrange(DOWN, aligned_edge=LEFT, buff=0.12)
        panel = RoundedRectangle(width=rows.width+0.35, height=rows.height+0.3,
                                 corner_radius=0.08, stroke_width=0,
                                 fill_color=BG, fill_opacity=0.95).move_to(rows)
        return VGroup(panel, rows)

    def make_small_emulsion(self, center, radius=R_SMALL):
        """Compact W/O droplet symbol for the overview scenes.

        At this scale individual phospholipids would overlap.  The red core is
        therefore surrounded by a blue head-group line and a pale tail halo.
        The molecular orientation is shown explicitly only in the close-up.
        """
        center = np.array(center, dtype=float)
        core = Circle(
            radius=radius,
            fill_color=INNER,
            fill_opacity=0.98,
            stroke_width=0,
        ).move_to(center)
        heads = Circle(
            radius=radius + 0.008,
            stroke_color=HEAD,
            stroke_width=1.15,
        ).move_to(center)
        tails = Circle(
            radius=radius + 0.019,
            stroke_color=TAIL,
            stroke_width=0.8,
            stroke_opacity=0.80,
        ).move_to(center)
        return VGroup(core, heads, tails)

    def make_tube_outline(self, center=ORIGIN, scale=1.0):
        c = np.array(center, dtype=float)
        w = 1.55 * scale
        top_y = 1.75 * scale
        shoulder_y = -0.45 * scale
        tip_y = -1.78 * scale
        tip_half = 0.13 * scale

        pts = [
            c + np.array([-w / 2, top_y, 0]),
            c + np.array([-w / 2, shoulder_y, 0]),
            c + np.array([-tip_half, tip_y, 0]),
            c + np.array([tip_half, tip_y, 0]),
            c + np.array([w / 2, shoulder_y, 0]),
            c + np.array([w / 2, top_y, 0]),
        ]
        outline = VMobject(stroke_color=GLASS, stroke_width=2.8, fill_opacity=0)
        outline.set_points_as_corners(pts)
        rim = RoundedRectangle(
            width=1.72 * scale,
            height=0.16 * scale,
            corner_radius=0.06 * scale,
            stroke_color=GLASS,
            stroke_width=2.5,
            fill_opacity=0,
        ).move_to(c + UP * 1.78 * scale)
        return VGroup(outline, rim)

    def make_outer_fill(self, center=ORIGIN, scale=1.0, interface_y=-0.18):
        c = np.array(center, dtype=float)
        y = interface_y * scale
        shoulder = -0.45 * scale
        tip = -1.70 * scale
        tip_half = 0.11 * scale
        half = 0.70 * scale

        if y >= shoulder:
            pts = [
                c + np.array([-half, y, 0]),
                c + np.array([half, y, 0]),
                c + np.array([half, shoulder, 0]),
                c + np.array([tip_half, tip, 0]),
                c + np.array([-tip_half, tip, 0]),
                c + np.array([-half, shoulder, 0]),
            ]
        else:
            t = np.clip((y - tip) / (shoulder - tip), 0, 1)
            half_here = tip_half + t * (half - tip_half)
            pts = [
                c + np.array([-half_here, y, 0]),
                c + np.array([half_here, y, 0]),
                c + np.array([tip_half, tip, 0]),
                c + np.array([-tip_half, tip, 0]),
            ]
        return Polygon(*pts, fill_color=OUTER, fill_opacity=0.95, stroke_width=0)

    def make_top_oil_fill(self, center=ORIGIN, scale=1.0, interface_y=-0.18, fraction=1.0):
        c = np.array(center, dtype=float)
        y0 = interface_y * scale
        y1 = (interface_y + 1.40 * fraction) * scale
        half = 0.70 * scale
        if fraction <= 0.01:
            y1 = y0 + 0.01
        return Rectangle(
            width=2 * half,
            height=max(y1 - y0, 0.01),
            fill_color=OIL,
            fill_opacity=0.92,
            stroke_width=0,
        ).move_to(c + UP * ((y0 + y1) / 2))

    def make_small_interface_row(self, center_x, y, width, n=15):
        xs = np.linspace(center_x - width / 2, center_x + width / 2, n)
        row = VGroup()
        for x in xs:
            row.add(self.make_lipid_at(np.array([x, y - 0.018, 0]), UP, scale=0.16))
        return row

    def zoom_and_cross_interface(self):
        focus_index = 28
        focus = self.layered_emulsions[focus_index]
        focus_point = focus.get_center().copy()

        # Remove labels before magnification so text does not become enormous.
        # The actual tube, oil and outer are kept; the camera itself zooms in.
        others = VGroup(*[
            d for i, d in enumerate(self.layered_emulsions) if i != focus_index
        ])
        # Remove non-focus droplets completely before the strong camera zoom so they cannot remain as ghost images.
        self.play(
            FadeOut(others),
            FadeOut(self.outer_text),
            FadeOut(self.legend),
            run_time=0.35,
        )

        self.camera.frame.save_state()
        zoom_center = np.array([
            focus_point[0],
            (focus_point[1] + self.interface_y_world) / 2,
            0,
        ])

        # Zoom strongly and explicitly remove the overview tube walls.  The close-up
        # uses local oil/outer background panels, so no tube edge or black gap can remain.
        self.play(
            self.camera.frame.animate.scale(0.10).move_to(zoom_center),
            FadeOut(self.target_tube),
            FadeOut(self.interface_lipids_small),
            run_time=2.0,
            rate_func=smooth,
        )

        # Local close-up backgrounds extend beyond the magnified camera frame.
        local_oil_bg = Rectangle(
            width=2.2, height=1.2, fill_color=OIL, fill_opacity=1, stroke_width=0
        ).move_to(np.array([zoom_center[0], self.interface_y_world + 0.60, 0]))
        local_outer_bg = Rectangle(
            width=2.2, height=1.2, fill_color=OUTER, fill_opacity=1, stroke_width=0
        ).move_to(np.array([zoom_center[0], self.interface_y_world - 0.60, 0]))
        self.add(local_oil_bg, local_outer_bg)
        local_oil_bg.set_z_index(-20)
        local_outer_bg.set_z_index(-20)
        self.target_oil.set_opacity(0)
        self.target_outer.set_opacity(0)

        # Molecular drawing replaces only the selected overview symbol after
        # zooming.  No scene cut and no artificial full-screen replacement.
        cx = focus_point[0]
        interface_y = self.interface_y_world
        R = 0.075
        L = 0.020
        R_INNER_HEAD = R
        R_OUTER_HEAD = R + 2 * L
        start_y = interface_y + R_OUTER_HEAD + 0.060
        end_y = interface_y - R_OUTER_HEAD - 0.040

        self.play(
            focus.animate.move_to(np.array([cx, start_y, 0])),
            run_time=0.55,
            rate_func=smooth,
        )
        self.play(FadeOut(focus), run_time=0.12)

        y = ValueTracker(start_y)

        core = always_redraw(lambda: Circle(
            radius=R,
            fill_color=INNER,
            fill_opacity=0.99,
            stroke_width=0,
        ).move_to(np.array([cx, y.get_value(), 0])))

        # Heads touch the inner aqueous phase; tails point into the surrounding oil.
        inner_leaflet = VGroup(*[
            always_redraw(
                lambda a=a, i=i: self.dynamic_inner_lipid_local(
                    a, cx, y.get_value(), R_INNER_HEAD, L, nbd=(i in (4, 23))
                )
            )
            for i, a in enumerate(np.linspace(0, TAU, 38, endpoint=False))
        ])

        # The planar oil/outer interface already carries lipids.  Their heads are
        # in outer and their tails point upward into oil.
        interface_xs = np.linspace(cx - 0.62, cx + 0.62, 39)
        interface_lipids = VGroup(*[
            always_redraw(
                lambda x=x: self.dynamic_interface_lipid_local(
                    x, cx, y.get_value(), R_OUTER_HEAD, interface_y
                )
            )
            for x in interface_xs
        ])

        # This is the second leaflet.  Each lipid begins at the planar interface
        # and continuously moves onto only the portion of the droplet that has
        # actually passed through the interface.  Bottom -> sides -> top.
        outer_leaflet = VGroup(*[
            always_redraw(
                lambda a=a, i=i: self.dynamic_wrapping_outer_lipid_local(
                    a, cx, y.get_value(), interface_y,
                    R_OUTER_HEAD, L, nbd=(i == 25)
                )
            )
            for i, a in enumerate(np.linspace(0, TAU, 38, endpoint=False))
        ])

        interface_line = Line(
            np.array([cx - 0.80, interface_y, 0]),
            np.array([cx + 0.80, interface_y, 0]),
            color=WHITE,
            stroke_width=0.75,
        )

        # Text remains available, but the geometry is understandable without it.
        # These objects are drawn at 1/10 scale because the camera is magnified 10x.
        close_labels = VGroup(
            Text("oil", font_size=24, color=BLACK).scale(0.10).move_to(zoom_center + LEFT * 0.55 + UP * 0.33),
            Text("outer", font_size=24, color=BLACK).scale(0.10).move_to(zoom_center + LEFT * 0.55 + DOWN * 0.33),
        )
        inner_word = Text("inner", font_size=22, color=WHITE).scale(0.085)
        inner_word.add_updater(lambda m: m.move_to(np.array([cx, y.get_value(), 0])))
        # Keep the molecular legend fixed to the screen instead of the zoomed world.
        # Without this, a 10x camera zoom magnifies the legend text enormously.
        # Keep the molecular key in normal scene coordinates.  MovingCameraScene in
        # Manim Community v0.21 does not provide add_fixed_in_frame_mobjects().
        # Because the camera is zoomed to 10x, scale the key down in world space so
        # it appears at a readable screen size without being magnified enormously.
        key = self.make_lipid_structure_key().scale(0.10)
        key.move_to(zoom_center + RIGHT * 0.35 + UP * 0.27)
        key.set_opacity(0)

        self.play(
            FadeIn(core),
            FadeIn(inner_leaflet),
            FadeIn(inner_word),
            FadeIn(interface_lipids),
            FadeIn(outer_leaflet),
            FadeIn(interface_line),
            FadeIn(close_labels),
            key.animate.set_opacity(1),
            run_time=0.65,
        )

        # Continuous sinking.  The red core remains the same size throughout;
        # the second leaflet is recruited smoothly from the interface as the
        # corresponding surface crosses it.  At the final y even the top of the
        # completed bilayer is below the interface.
        self.play(
            y.animate.set_value(end_y),
            run_time=7.5,
            rate_func=linear,
        )
        self.wait(0.65)

        self.closeup = VGroup(
            core, inner_leaflet, outer_leaflet, inner_word,
            interface_lipids, interface_line,
        )
        self.close_labels = close_labels
        self.close_key = key
        self.close_bg = VGroup(local_oil_bg, local_outer_bg)
        self.zoom_bench_group = VGroup(
            focus,
        )

    def dynamic_inner_lipid_local(self, angle, cx, cy, head_radius, tail_len, nbd=False):
        u = np.array([np.cos(angle), np.sin(angle), 0])
        center = np.array([cx, cy, 0])
        head = center + u * head_radius
        scale = tail_len / 0.24
        return self.make_lipid_at(head, u, scale=scale, nbd=nbd)

    def dynamic_interface_lipid_local(self, x, cx, cy, contact_radius, interface_y):
        # Lipids disappear only from the exact contact patch from which the
        # second leaflet is being recruited.
        dy = cy - interface_y
        if abs(dy) < contact_radius:
            half = np.sqrt(max(contact_radius ** 2 - dy ** 2, 0.0))
            inside = half - abs(x - cx)
            opacity = np.clip(1.0 - (inside + 0.010) / 0.020, 0.0, 1.0)
        else:
            opacity = 1.0
        return self.make_lipid_at(
            np.array([x, interface_y - 0.006, 0]),
            UP,
            scale=tail_len_to_scale(0.020),
            opacity=opacity,
        )

    def dynamic_wrapping_outer_lipid_local(
        self, angle, cx, cy, interface_y,
        outer_head_radius, tail_len, nbd=False
    ):
        u = np.array([np.cos(angle), np.sin(angle), 0])
        center = np.array([cx, cy, 0])
        target_head = center + u * outer_head_radius

        # t starts only after this particular target point crosses the interface.
        # Thus the lower surface acquires the second leaflet first, followed
        # continuously by the sides and finally the top.
        band = 0.028
        t = np.clip((interface_y - target_head[1]) / band, 0.0, 1.0)
        t_smooth = t * t * (3 - 2 * t)

        source_head = np.array([target_head[0], interface_y - 0.006, 0])
        head = (1 - t_smooth) * source_head + t_smooth * target_head

        target_dir = -u  # tails point inward in the completed outer leaflet
        v = (1 - t_smooth) * UP + t_smooth * target_dir
        if np.linalg.norm(v[:2]) < 1e-7:
            v = target_dir

        scale = tail_len / 0.24
        opacity = np.clip(t * 5.0, 0.0, 1.0)
        return self.make_lipid_at(head, v, scale=scale, opacity=opacity, nbd=nbd)
