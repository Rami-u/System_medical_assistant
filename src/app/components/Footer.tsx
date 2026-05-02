import { Activity, Twitter, Linkedin, Github, Mail, Heart } from "lucide-react";

const footerLinks = {
  Product: ["Features", "Pricing", "How It Works", "Changelog", "Roadmap"],
  Health: ["Diabetes Guide", "Blood Monitoring", "AI Insights", "Research", "Clinical Partners"],
  Company: ["About Us", "Blog", "Careers", "Press Kit", "Contact"],
  Legal: ["Privacy Policy", "Terms of Service", "Cookie Policy", "HIPAA Notice", "Accessibility"],
};

const socialLinks = [
  { icon: Twitter, label: "Twitter" },
  { icon: Linkedin, label: "LinkedIn" },
  { icon: Github, label: "GitHub" },
  { icon: Mail, label: "Email" },
];

export function Footer() {
  return (
    <footer className="bg-slate-900 text-slate-400">
      {/* Main Footer Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-10">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-8 mb-12">
          {/* Brand Column */}
          

          {/* Link Columns */}
          {Object.entries(footerLinks).map(([category, links]) => (
            null
          ))}
        </div>

        {/* Divider */}
        <div className="border-t border-slate-800 pt-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-xs text-slate-600">
              © 2026 DiaCheck Health Technologies, Inc. All rights reserved.
            </p>
            
            <p className="text-xs text-slate-600">
              ⚕️ Not a substitute for professional medical advice
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
