# Adapted from the team-provided InterfaceCrossingRevised animation.
from manim import *
import numpy as np

OIL = "#E8C65A"
OUTER = "#B9D9F2"
INNER = "#F56576"
HEAD = "#4A91F2"
TAIL = "#F4F4F4"


class EmulsionTransferWeb(MovingCameraScene):
    def construct(self):
        cx = 0.0
        interface_y = 0.0
        zoom_center = np.array([cx, 0.09, 0.0])
        self.camera.frame.scale(0.10).move_to(zoom_center)

        # Local close-up backgrounds extend beyond the magnified camera frame.
        local_oil_bg = Rectangle(
            width=2.2, height=1.2, fill_color=OIL, fill_opacity=1, stroke_width=0
        ).move_to(np.array([zoom_center[0], interface_y + 0.60, 0]))
        local_outer_bg = Rectangle(
            width=2.2, height=1.2, fill_color=OUTER, fill_opacity=1, stroke_width=0
        ).move_to(np.array([zoom_center[0], interface_y - 0.60, 0]))
        self.add(local_oil_bg, local_outer_bg)
        local_oil_bg.set_z_index(-20)
        local_outer_bg.set_z_index(-20)
        R = 0.075
        L = 0.020
        R_INNER_HEAD = R
        R_OUTER_HEAD = R + 2 * L
        # Start at the position shown around 5 seconds in the original video.
        original_start_y = R_OUTER_HEAD + 0.060
        end_y = -R_OUTER_HEAD - 0.040
        elapsed = 0.1
        start_y = interpolate(original_start_y, end_y, elapsed / 7.5)

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
                lambda a=a: self.dynamic_inner_lipid_local(
                    a, cx, y.get_value(), R_INNER_HEAD, L
                )
            )
            for a in np.linspace(0, TAU, 38, endpoint=False)
        ])

        # The planar oil/outer interface already carries lipids.  Their heads are
        # in outer and their tails point upward into oil.
        # Adjacent head groups touch across the visible interface.
        head_diameter = 2 * 0.060 * (0.020 / 0.24)
        frame = self.camera.frame
        interface_xs = np.arange(
            frame.get_left()[0] - head_diameter,
            frame.get_right()[0] + head_diameter,
            head_diameter,
        )
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
                lambda a=a: self.dynamic_wrapping_outer_lipid_local(
                    a, cx, y.get_value(), interface_y,
                    R_OUTER_HEAD, L
                )
            )
            for a in np.linspace(0, TAU, 38, endpoint=False)
        ])

        # Text remains available, but the geometry is understandable without it.
        # These objects are drawn at 1/10 scale because the camera is magnified 10x.
        close_labels = VGroup(
            Text("oil", font_size=24, color=BLACK).scale(0.10).move_to(zoom_center + LEFT * 0.55 + UP * 0.33),
            Text("outer", font_size=24, color=BLACK).scale(0.10).move_to(zoom_center + LEFT * 0.55 + DOWN * 0.33),
        )
        inner_word = Text("inner", font_size=22, color=WHITE).scale(0.085)
        inner_word.add_updater(lambda m: m.move_to(np.array([cx, y.get_value(), 0])))
        inner_word.move_to([cx, start_y, 0])
        key = self.make_lipid_structure_key().scale(0.10)
        key.move_to(zoom_center + RIGHT * 0.35 + UP * 0.27)
        self.add(core, inner_leaflet, inner_word, interface_lipids,
                 outer_leaflet, close_labels, key)

        # Continuous sinking.  The red core remains the same size throughout;
        # the second leaflet is recruited smoothly from the interface as the
        # corresponding surface crosses it.  At the final y even the top of the
        # completed bilayer is below the interface.
        self.play(
            y.animate.set_value(end_y),
            run_time=7.5 - elapsed,
            rate_func=linear,
        )
        for moving in (core, inner_leaflet, outer_leaflet, inner_word, interface_lipids):
            moving.suspend_updating()
        self.wait(2.15)

    def make_lipid_at(self, head_pos, tail_dir, scale=1.0, opacity=1.0):
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
        g.set_opacity(opacity)
        return g

    def make_lipid_structure_key(self):
        ink = "#132437"
        tails = VGroup(
            Line(UP * 0.075, DOWN * 0.075 + LEFT * 0.055, color=WHITE, stroke_width=0.25),
            Line(UP * 0.075, DOWN * 0.075 + RIGHT * 0.055, color=WHITE, stroke_width=0.25),
        )
        rows = VGroup(
            VGroup(Dot(color=HEAD, radius=0.06), Text("hydrophilic head", font_size=20, color=ink)).arrange(RIGHT, buff=0.12),
            VGroup(tails, Text("hydrophobic tails", font_size=20, color=ink)).arrange(RIGHT, buff=0.12),
        ).arrange(DOWN, aligned_edge=LEFT, buff=0.12)
        panel = RoundedRectangle(
            width=rows.width + 0.35, height=rows.height + 0.3,
            corner_radius=0.08, stroke_width=0,
            fill_color="#A4B5C7", fill_opacity=1,
        ).move_to(rows)
        return VGroup(panel, rows)

    def dynamic_inner_lipid_local(self, angle, cx, cy, head_radius, tail_len):
        u = np.array([np.cos(angle), np.sin(angle), 0])
        center = np.array([cx, cy, 0])
        head = center + u * head_radius
        scale = tail_len / 0.24
        return self.make_lipid_at(head, u, scale=scale)

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
            scale=0.020 / 0.24,
            opacity=opacity,
        )

    def dynamic_wrapping_outer_lipid_local(
        self, angle, cx, cy, interface_y,
        outer_head_radius, tail_len
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
        return self.make_lipid_at(head, v, scale=scale, opacity=opacity)
