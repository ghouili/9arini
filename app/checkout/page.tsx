"use client";
import { Suspense } from "react";
import { Spinner } from "@/components/ui";
import { SiteShell } from "@/components/SiteShell";
import CheckoutInner from "@/components/checkout/CheckoutInner";

export default function CheckoutPage() {
  return (
    <SiteShell>
      <section className="web-section tight">
        <div className="container container-narrow">
          <Suspense
            fallback={
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  minHeight: 240,
                }}
              >
                <Spinner />
              </div>
            }
          >
            <CheckoutInner />
          </Suspense>
        </div>
      </section>
    </SiteShell>
  );
}
