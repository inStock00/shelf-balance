import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Linkedin, MapPin, Code2, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export default function Contact() {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", subject: "", message: "" });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.functions.invoke("send-contact-email", {
        body: { ...form },
      });
      if (error) throw error;
      toast.success("Message sent! I'll get back to you soon.");
      setForm({ name: "", email: "", subject: "", message: "" });
    } catch {
      toast.error("Failed to send message. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary transition-colors mb-6">
          <ArrowLeft className="h-4 w-4" />
          Back to app
        </Link>

        <div className="grid md:grid-cols-5 gap-6">
          {/* About Section */}
          <div className="md:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Code2 className="h-5 w-5 text-primary" />
                  About the Architect
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm text-muted-foreground">
                <p>
                  With 15+ years of experience in full-stack architecture, I specialize in building
                  scalable business tools using React, PHP, and Node.js. Since 2010, I've helped
                  companies streamline operations through custom-built software and enterprise
                  integrations like SAP CDC.
                </p>
                <div className="flex items-center gap-2 text-xs">
                  <MapPin className="h-3.5 w-3.5" />
                  Angeles City, PH
                </div>
                <a
                  href="https://www.linkedin.com/in/iosh"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-xs font-medium text-primary hover:underline"
                >
                  <Linkedin className="h-3.5 w-3.5" />
                  Connect on LinkedIn
                </a>
              </CardContent>
            </Card>
          </div>

          {/* Contact Form */}
          <div className="md:col-span-3">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Get in Touch</CardTitle>
                <CardDescription>
                  Have a question or a project in mind? Send me a message.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Name</Label>
                      <Input
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                        placeholder="Your name"
                        required
                      />
                    </div>
                    <div>
                      <Label>Email</Label>
                      <Input
                        type="email"
                        value={form.email}
                        onChange={(e) => setForm({ ...form, email: e.target.value })}
                        placeholder="you@example.com"
                        required
                      />
                    </div>
                  </div>
                  <div>
                    <Label>Subject</Label>
                    <Input
                      value={form.subject}
                      onChange={(e) => setForm({ ...form, subject: e.target.value })}
                      placeholder="Project inquiry"
                      required
                    />
                  </div>
                  <div>
                    <Label>Message</Label>
                    <Textarea
                      value={form.message}
                      onChange={(e) => setForm({ ...form, message: e.target.value })}
                      placeholder="Tell me about your project..."
                      rows={5}
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? "Sending..." : "Send Message"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
