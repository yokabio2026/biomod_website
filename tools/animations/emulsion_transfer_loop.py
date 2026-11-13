from manim import *
import numpy as np


class EmulsionTransferLoop(Scene):
    def construct(self):
        oil, outer, inner = "#E9BF55", "#B4D9F2", "#F46C7F"
        ink, head = "#202638", "#347CD0"
        width, height = config.frame_width, config.frame_height
        interface = 0
        self.add(
            Rectangle(width=width, height=height/2, stroke_width=0, fill_color=oil, fill_opacity=1).shift(UP*height/4),
            Rectangle(width=width, height=height/2, stroke_width=0, fill_color=outer, fill_opacity=1).shift(DOWN*height/4),
        )
        for label, y in [("Oil phase", 2.55), ("Outer phase", -2.55)]:
            self.add(Text(label, font="Arial", weight=BOLD, font_size=51, color=ink).move_to([4.5,y,0]))
        y = ValueTracker(2.25)
        def lipids():
            center = y.get_value()
            return VGroup(*[
                VGroup(Line([x,interface,0],[x,0.18,0],color=WHITE,stroke_width=3),
                       Dot([x,-0.04,0],radius=.070,color=head))
                for x in np.arange(-width/2+.1,width/2,.25)
                if abs(center)>1.0 or abs(x)>np.sqrt(max(0,1-center**2))
            ])
        self.add(always_redraw(lipids))
        def droplet():
            center=np.array([0,y.get_value(),0])
            g=VGroup(Circle(radius=.88,stroke_width=0,fill_color=inner,fill_opacity=1).move_to(center))
            for angle in np.linspace(0,TAU,36,endpoint=False):
                u=np.array([np.cos(angle),np.sin(angle),0])
                g.add(Line(center+.91*u,center+1.10*u,color=WHITE,stroke_width=3),
                      Dot(center+.91*u,radius=.070,color=head))
                if (center+1.15*u)[1]<0:
                    g.add(Line(center+1.12*u,center+1.30*u,color=WHITE,stroke_width=3),
                          Dot(center+1.30*u,radius=.070,color=head))
            g.add(Text("Inner",font="Arial",weight=BOLD,font_size=34,color=ink).move_to(center))
            return g
        self.add(always_redraw(droplet))
        self.play(y.animate.set_value(-2.35),run_time=1.65,rate_func=linear)
        self.wait(.35)
