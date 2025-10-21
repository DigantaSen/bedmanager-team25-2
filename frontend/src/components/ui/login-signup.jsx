"use client";

import * as React from "react";
import { useState, useRef, useEffect } from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Eye,
  EyeOff,
  Github,
  Lock,
  Mail,
  ArrowRight,
  Chrome,
} from "lucide-react";
import { HeroHighlight } from "@/components/ui/hero-highlight";

export default function LoginCardSection() {
  const [showPassword, setShowPassword] = useState(false);
  const [showLoginPw, setShowLoginPw] = useState(false);
  const [showSignupPw, setShowSignupPw] = useState(false);
  const [activeTab, setActiveTab] = useState("login");

  // Background is provided by HeroHighlight; particle canvas removed.

  return (
    <HeroHighlight center={false} containerClassName="fixed inset-0 text-zinc-50">
      <style>{`
        .accent-lines{position:absolute;inset:0;pointer-events:none;opacity:.7}
        .hline,.vline{position:absolute;background:#27272a;will-change:transform,opacity}
        .hline{left:0;right:0;height:1px;transform:scaleX(0);transform-origin:50% 50%;animation:drawX .8s cubic-bezier(.22,.61,.36,1) forwards}
        .vline{top:0;bottom:0;width:1px;transform:scaleY(0);transform-origin:50% 0%;animation:drawY .9s cubic-bezier(.22,.61,.36,1) forwards}
        .hline:nth-child(1){top:18%;animation-delay:.12s}
        .hline:nth-child(2){top:50%;animation-delay:.22s}
        .hline:nth-child(3){top:82%;animation-delay:.32s}
        .vline:nth-child(4){left:22%;animation-delay:.42s}
        .vline:nth-child(5){left:50%;animation-delay:.54s}
        .vline:nth-child(6){left:78%;animation-delay:.66s}
        .hline::after,.vline::after{content:"";position:absolute;inset:0;background:linear-gradient(90deg,transparent,rgba(250,250,250,.24),transparent);opacity:0;animation:shimmer .9s ease-out forwards}
        .hline:nth-child(1)::after{animation-delay:.12s}
        .hline:nth-child(2)::after{animation-delay:.22s}
        .hline:nth-child(3)::after{animation-delay:.32s}
        .vline:nth-child(4)::after{animation-delay:.42s}
        .vline:nth-child(5)::after{animation-delay:.54s}
        .vline:nth-child(6)::after{animation-delay:.66s}
        @keyframes drawX{0%{transform:scaleX(0);opacity:0}60%{opacity:.95}100%{transform:scaleX(1);opacity:.7}}
        @keyframes drawY{0%{transform:scaleY(0);opacity:0}60%{opacity:.95}100%{transform:scaleY(1);opacity:.7}}
        @keyframes shimmer{0%{opacity:0}35%{opacity:.25}100%{opacity:0}}

        /* === Card minimal fade-up animation === */
        .card-animate {
          opacity: 0;
          transform: translateY(20px);
          animation: fadeUp 0.8s cubic-bezier(.22,.61,.36,1) 0.4s forwards;
        }
        @keyframes fadeUp {
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
      {/* Subtle vignette */}
      <div
        className="absolute inset-0 pointer-events-none [background:radial-gradient(80%_60%_at_50%_30%,rgba(255,255,255,0.06),transparent_60%)]" />
      {/* Animated accent lines */}
      <div className="accent-lines">
        <div className="hline" />
        <div className="hline" />
        <div className="hline" />
        <div className="vline" />
        <div className="vline" />
        <div className="vline" />
      </div>
      {/* Header removed: branding and contact button intentionally omitted */}
      {/* Centered Login Card with Tabs (Login / Sign Up) */}
      <div className="min-h-screen w-full grid place-items-center px-4">
        <Card className="relative z-[5100] card-animate w-full max-w-md border-zinc-800 bg-zinc-900/70 backdrop-blur supports-[backdrop-filter]:bg-zinc-900/60">
          <CardHeader className="space-y-1 text-left pl-4 pr-4 pt-6">
            <CardTitle className="text-2xl">Welcome</CardTitle>
            <CardDescription className="text-zinc-400">Log in or create an account</CardDescription>
          </CardHeader>

          <CardContent className="pl-4 pr-4">
            {/* Controlled Tabs: only render the active panel to prevent stacking */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="auth-tabs w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login">Log In</TabsTrigger>
                <TabsTrigger value="signup">Sign Up</TabsTrigger>
              </TabsList>

              <div className="tab-shell mt-6">
                {activeTab === "login" && (
                  <div className="tab-panel space-y-5">
                    <div className="grid gap-2 text-left">
                      <Label htmlFor="login-email" className="text-zinc-300">Email</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                        <Input id="login-email" type="email" placeholder="you@example.com" className="pl-10 bg-zinc-950 border-zinc-800 text-zinc-50 placeholder:text-zinc-600" />
                      </div>
                    </div>

                    <div className="grid gap-2 text-left">
                      <Label htmlFor="login-password" className="text-zinc-300">Password</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                        <Input id="login-password" type={showLoginPw ? "text" : "password"} placeholder="••••••••" className="pl-10 pr-10 bg-zinc-950 border-zinc-800 text-zinc-50 placeholder:text-zinc-600" />
                        <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-md text-zinc-400 hover:text-zinc-200" onClick={() => setShowLoginPw(v => !v)} aria-label={showLoginPw ? "Hide password" : "Show password"}>
                          {showLoginPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Checkbox id="remember" className="border-zinc-700 data-[state=checked]:bg-zinc-50 data-[state=checked]:text-zinc-900" />
                        <Label htmlFor="remember" className="text-zinc-400">Remember me</Label>
                      </div>
                      <a href="#" className="text-sm text-zinc-300 hover:text-zinc-100">Forgot password?</a>
                    </div>

                    <Button className="w-full h-10 rounded-lg bg-zinc-50 text-zinc-900 hover:bg-zinc-200">Continue</Button>

                    {/* <div className="relative">
                      <Separator className="bg-zinc-800" />
                      <span className="absolute left-1/2 -translate-x-1/2 -top-3 bg-zinc-900/70 px-2 text-[11px] uppercase tracking-widest text-zinc-500">or</span>
                    </div> */}

                    {/* <div className="grid grid-cols-2 gap-3">
                      <Button variant="outline" className="h-10 rounded-lg border-zinc-800 bg-zinc-950 text-zinc-50 hover:bg-zinc-900/80"><Github className="h-4 w-4 mr-2" /> GitHub</Button>
                      <Button variant="outline" className="h-10 rounded-lg border-zinc-800 bg-zinc-950 text-zinc-50 hover:bg-zinc-900/80"><Chrome className="h-4 w-4 mr-2" /> Google</Button>
                    </div> */}
                  </div>
                )}

                {activeTab === "signup" && (
                  <div className="tab-panel space-y-5">
                    <div className="grid gap-2 text-left">
                      <Label htmlFor="name" className="text-zinc-300">Full Name</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                        <Input id="name" type="text" placeholder="John Doe" className="pl-10 bg-zinc-950 border-zinc-800 text-zinc-50 placeholder:text-zinc-600" />
                      </div>
                    </div>

                    <div className="grid gap-2 text-left">
                      <Label htmlFor="signup-email" className="text-zinc-300">Email</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                        <Input id="signup-email" type="email" placeholder="you@example.com" className="pl-10 bg-zinc-950 border-zinc-800 text-zinc-50 placeholder:text-zinc-600" />
                      </div>
                    </div>

                    <div className="grid gap-2 text-left">
                      <Label htmlFor="signup-password" className="text-zinc-300">Password</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                        <Input id="signup-password" type={showSignupPw ? "text" : "password"} placeholder="••••••••" className="pl-10 pr-10 bg-zinc-950 border-zinc-800 text-zinc-50 placeholder:text-zinc-600" />
                        <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-md text-zinc-400 hover:text-zinc-200" onClick={() => setShowSignupPw(v => !v)} aria-label={showSignupPw ? "Hide password" : "Show password"}>
                          {showSignupPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Checkbox id="terms" className="border-zinc-700 data-[state=checked]:bg-zinc-50 data-[state=checked]:text-zinc-900" />
                      <Label htmlFor="terms" className="text-zinc-400 text-sm">I agree to the Terms & Privacy</Label>
                    </div>

                    <Button className="w-full h-10 rounded-lg bg-zinc-50 text-zinc-900 hover:bg-zinc-200">Create account</Button>
                    {/* 
                    <div className="relative">
                      <Separator className="bg-zinc-800" />
                      <span className="absolute left-1/2 -translate-x-1/2 -top-3 bg-zinc-900/70 px-2 text-[11px] uppercase tracking-widest text-zinc-500">or</span>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <Button variant="outline" className="h-10 rounded-lg border-zinc-800 bg-zinc-950 text-zinc-50 hover:bg-zinc-900/80"><Github className="h-4 w-4 mr-2" /> GitHub</Button>
                      <Button variant="outline" className="h-10 rounded-lg border-zinc-800 bg-zinc-950 text-zinc-50 hover:bg-zinc-900/80"><Chrome className="h-4 w-4 mr-2" /> Google</Button>
                    </div> */}
                  </div>
                )}
              </div>
            </Tabs>
          </CardContent>

          {/* <CardFooter className="flex items-center justify-center text-sm text-zinc-400">
            Need help? <a className="ml-1 text-zinc-200 hover:underline" href="#">Contact support</a>
          </CardFooter> */}
        </Card>
      </div>
    </HeroHighlight>
  );
}
