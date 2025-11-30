"use client";

import Link from "next/link";
import { Shield, CheckCircle2, Zap, Lock } from "lucide-react";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { SignInButton, SignUpButton } from "@clerk/nextjs";

export function LandingPage() {
  return (
    <div className="container mx-auto space-y-8">
      {/* Hero Section */}
      <div className="py-16 md:py-24">
        <div className="mx-auto max-w-3xl text-center">
          <div className="mb-6 flex justify-center">
            <div className="rounded-full bg-primary/10 p-4">
              <Shield className="h-12 w-12 text-primary" />
            </div>
          </div>
          <h1 className="mb-4 text-4xl font-bold tracking-tight md:text-6xl">
            AI-Powered URL Safety
          </h1>
          <p className="mb-8 text-lg text-muted-foreground md:text-xl">
            Protect yourself from malicious links with advanced AI screening
            technology
          </p>
          <div className="flex flex-col gap-4 sm:flex-row sm:justify-center">
            <SignUpButton mode="modal">
              <Button size="lg" className="w-full sm:w-auto">
                Get Started
              </Button>
            </SignUpButton>
            <SignInButton mode="modal">
              <Button size="lg" variant="outline" className="w-full sm:w-auto">
                Sign In
              </Button>
            </SignInButton>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="border-t bg-muted/50 py-8">
        <div className="grid gap-6 md:grid-cols-3">
          <Card>
            <CardHeader>
              <Zap className="mb-2 h-8 w-8 text-primary" />
              <CardTitle>Lightning Fast</CardTitle>
              <CardDescription>
                Get instant results with real-time URL analysis
              </CardDescription>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <Shield className="mb-2 h-8 w-8 text-primary" />
              <CardTitle>AI-Powered</CardTitle>
              <CardDescription>
                Advanced machine learning detects threats accurately
              </CardDescription>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <Lock className="mb-2 h-8 w-8 text-primary" />
              <CardTitle>Secure & Private</CardTitle>
              <CardDescription>
                Your data is protected with enterprise-grade security
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </div>
    </div>
  );
}
