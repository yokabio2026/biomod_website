from manim import *


class DnaLipidCoupling(Scene):
    def construct(self):
        self.camera.background_color = "#0d111b"
        blue, orange = "#4abdec", "#ffae73"
        dna = VGroup(Line(LEFT*5, LEFT*1.5, color=blue, stroke_width=7))
        for i in range(12):
            dna.add(Rectangle(width=.14, height=.24, stroke_width=0,
                              fill_color=[blue, "#82c784", "#ff9271", "#e5c15f"][i % 4],
                              fill_opacity=1).move_to([-4.85+i*.28, .14, 0]))
        name = Text("DNA", font_size=38).move_to([-3.3, -.65, 0])
        sulfur = Text("S", font_size=38).move_to([-1.2, 0, 0])
        cap_color = "#cf9be7"
        cover = VMobject(color=cap_color, stroke_width=10)
        cover.set_points_as_corners([
            [-1.56, .32, 0], [-.72, .32, 0],
            [-.72, -.32, 0], [-1.56, -.32, 0],
        ])
        cap = VGroup(cover, Text("Cap", font_size=27, color=cap_color)
                     .next_to(cover, UP, buff=.12))
        hydrogen = Text("H", font_size=38).next_to(sulfur, RIGHT, buff=.08)
        ring = RegularPolygon(5, radius=.38, color=orange).move_to([1.5, 0, 0])
        lipid = VGroup(ring, Line([1.86,0,0],[2.45,0,0],color=orange),
                       Dot([2.45,0,0],radius=.11,color=orange),
                       CubicBezier([2.45,0,0],[2.8,.45,0],[3.2,.45,0],[3.65,.35,0],color=orange),
                       CubicBezier([2.45,0,0],[2.8,-.45,0],[3.2,-.45,0],[3.65,-.35,0],color=orange))
        lipid_label = Text("DOPE-MAL", font_size=34, color=orange).move_to([2.45,-.72,0])
        self.add(dna, name, sulfur, cap)
        self.wait(.35)
        self.play(FadeOut(cap, shift=UP*.45), FadeIn(hydrogen), run_time=.30)
        self.wait(.20)
        self.play(FadeIn(lipid), FadeIn(lipid_label), run_time=.20)
        self.play(lipid.animate.shift(LEFT*1.55), lipid_label.animate.shift(LEFT*1.55),
                  dna.animate.shift(RIGHT*.30), name.animate.shift(RIGHT*.30),
                  sulfur.animate.shift(RIGHT*.30), FadeOut(hydrogen, shift=RIGHT*.30), run_time=.35)
        self.play(Create(Line([-.68,0,0],[-.39,0,0],color=orange)), Flash([-.535,0,0], color="#fff0ad", line_length=.22, flash_radius=.26, line_stroke_width=4), run_time=.25)
        self.wait(.35)
