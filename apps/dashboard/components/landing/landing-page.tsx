"use client";

import { SignInButton, SignUpButton } from "@clerk/nextjs";
import { ArrowRight, Lock, Shield, Zap } from "lucide-react";

import { Button } from "~/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";

export function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Hero Section */}
      <section className="border-b py-24 md:py-32">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="mb-6 text-4xl font-bold tracking-tight md:text-6xl">
              AI-Powered URL Safety
            </h1>
            <p className="mb-10 text-lg text-muted-foreground md:text-xl">
              Protect yourself from malicious links with advanced AI screening
              technology
            </p>
            <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
              <SignUpButton mode="modal">
                <Button size="lg" className="group w-full sm:w-auto">
                  Get Started
                  <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
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
      </section>

      {/* Features Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="grid gap-6 md:grid-cols-3">
            <Card>
              <CardHeader>
                <Zap className="mb-2 h-8 w-8 text-primary" />
                <CardTitle>Fast Analysis</CardTitle>
                <CardDescription>
                  Real-time URL analysis with quick results
                </CardDescription>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <Shield className="mb-2 h-8 w-8 text-primary" />
                <CardTitle>AI-Powered</CardTitle>
                <CardDescription>
                  Advanced machine learning for threat detection
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
      </section>
    </div>
  );
}
