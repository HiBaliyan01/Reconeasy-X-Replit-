import React from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { ThemeProvider } from "./components/ThemeProvider";

function SimpleApp() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <div className="min-h-screen bg-background text-foreground">
          <div className="container mx-auto p-8">
            <h1 className="text-4xl font-bold mb-8">E-Commerce Financial Management Platform</h1>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-card p-6 rounded-lg shadow">
                <h2 className="text-2xl font-semibold mb-4">Dashboard</h2>
                <p className="text-muted-foreground">Overview of key metrics and insights</p>
              </div>
              <div className="bg-card p-6 rounded-lg shadow">
                <h2 className="text-2xl font-semibold mb-4">Rate Cards</h2>
                <p className="text-muted-foreground">Marketplace fee configuration</p>
              </div>
              <div className="bg-card p-6 rounded-lg shadow">
                <h2 className="text-2xl font-semibold mb-4">Reconciliation</h2>
                <p className="text-muted-foreground">Payment tracking and settlement</p>
              </div>
            </div>
            <div className="mt-8 p-4 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-green-800">✅ App successfully started! Basic components are working.</p>
            </div>
          </div>
        </div>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default SimpleApp;