"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Send, Bot, User, Sparkles } from "lucide-react"

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: Date
  isLoading?: boolean
}

export default function ChatbotPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      role: "assistant",
      content: "Hello! I'm your AI health assistant. I can answer general medical questions, explain health concepts, and provide information about symptoms, conditions, and treatments. How can I help you today?",
      timestamp: new Date(),
    },
  ])
  const [input, setInput] = useState("")
  const [isTyping, setIsTyping] = useState(false)

  const handleSend = async () => {
    if (!input.trim() || isTyping) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input,
      timestamp: new Date(),
    }

    const questionText = input
    setMessages((prev) => [...prev, userMessage])
    setInput("")
    setIsTyping(true)

    // Add loading message
    const loadingMessage: Message = {
      id: "loading",
      role: "assistant",
      content: "",
      timestamp: new Date(),
      isLoading: true,
    }
    setMessages((prev) => [...prev, loadingMessage])

    // Call the chatbot API
    try {
      const response = await fetch("/api/chatbot", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          question: questionText,
          conversationHistory: messages.map(msg => ({
            role: msg.role,
            content: msg.content
          })),
        }),
      });

      const data = await response.json();

      // Remove loading message
      setMessages((prev) => prev.filter(msg => msg.id !== "loading"))

      if (data.success && data.answer) {
        const aiMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: data.answer,
          timestamp: new Date(),
        }
        setMessages((prev) => [...prev, aiMessage])
      } else {
        const errorMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: "Sorry, I encountered an error. Please try again.",
          timestamp: new Date(),
        }
        setMessages((prev) => [...prev, errorMessage])
      }
    } catch (error) {
      console.error("Chat error:", error);
      // Remove loading message
      setMessages((prev) => prev.filter(msg => msg.id !== "loading"))
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "Sorry, I encountered an error. Please try again.",
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, errorMessage])
    } finally {
      setIsTyping(false)
    }
  }

  return (
    <div className="mobile-card-spacing h-full flex flex-col">
      <div>
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">AI Health Chatbot</h2>
        <p className="text-sm sm:text-base text-muted-foreground">
          Get instant answers to your medical questions with AI-powered assistance
        </p>
      </div>

      <Card className="flex-1 flex flex-col">
        <CardHeader className="px-3 py-3 sm:px-6 sm:py-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
            <CardTitle className="text-base sm:text-lg">Chat with AI Assistant</CardTitle>
          </div>
          <CardDescription className="text-xs sm:text-sm">
            Ask questions about your health, lab results, medications, or general wellness
          </CardDescription>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col p-0">
          <ScrollArea className="flex-1 p-3 sm:p-4 md:p-6">
            <div className="space-y-3 sm:space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex gap-2 sm:gap-3 ${
                    message.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  {message.role === "assistant" && (
                    <Avatar className="h-7 w-7 sm:h-8 sm:w-8 flex-shrink-0">
                      <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white">
                        <Bot className="h-3 w-3 sm:h-4 sm:w-4" />
                      </AvatarFallback>
                    </Avatar>
                  )}
                  <div
                    className={`rounded-lg px-3 py-2 sm:px-4 sm:py-2 max-w-[85%] sm:max-w-[80%] ${
                      message.role === "user"
                        ? "bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-md"
                        : "bg-muted/80 shadow-sm"
                    }`}
                  >
                    {message.isLoading ? (
                      <div className="flex items-center gap-2 py-1">
                        <Bot className="h-4 w-4 text-blue-600 animate-pulse" />
                        <div className="flex gap-1">
                          <span className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: "0ms" }}></span>
                          <span className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: "150ms" }}></span>
                          <span className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: "300ms" }}></span>
                        </div>
                      </div>
                    ) : (
                      <>
                        <p className="text-xs sm:text-sm break-words leading-relaxed">{message.content}</p>
                        <p
                          className={`text-xs mt-1 ${
                            message.role === "user"
                              ? "text-blue-100"
                              : "text-muted-foreground"
                          }`}
                        >
                          {message.timestamp.toLocaleTimeString()}
                        </p>
                      </>
                    )}
                  </div>
                  {message.role === "user" && (
                    <Avatar className="h-7 w-7 sm:h-8 sm:w-8 flex-shrink-0">
                      <AvatarFallback className="bg-secondary">
                        <User className="h-3 w-3 sm:h-4 sm:w-4" />
                      </AvatarFallback>
                    </Avatar>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>
          <div className="border-t p-3 sm:p-4">
            <div className="flex gap-2">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault()
                    handleSend()
                  }
                }}
                placeholder="Type your question here..."
                className="flex-1 text-sm"
                disabled={isTyping}
              />
              <Button 
                onClick={handleSend} 
                size="icon" 
                className="tap-target flex-shrink-0 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700" 
                disabled={isTyping || !input.trim()}
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              This AI assistant is for informational purposes only and does not replace professional medical advice.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="p-3 sm:p-4">
            <CardTitle className="text-sm sm:text-base">Quick Questions</CardTitle>
          </CardHeader>
          <CardContent className="p-3 sm:p-4 pt-0">
            <div className="space-y-2">
              <Button
                variant="outline"
                className="w-full justify-start text-left text-xs sm:text-sm h-auto py-2 sm:py-2.5"
                onClick={() => setInput("What do my lab results mean?")}
              >
                What do my lab results mean?
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start text-left text-xs sm:text-sm h-auto py-2 sm:py-2.5"
                onClick={() => setInput("Explain my cholesterol levels")}
              >
                Explain my cholesterol levels
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start text-left text-xs sm:text-sm h-auto py-2 sm:py-2.5"
                onClick={() => setInput("What is a normal blood pressure?")}
              >
                What is a normal blood pressure?
              </Button>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="p-3 sm:p-4">
            <CardTitle className="text-sm sm:text-base">Health Tips</CardTitle>
          </CardHeader>
          <CardContent className="p-3 sm:p-4 pt-0">
            <p className="text-xs sm:text-sm text-muted-foreground">
              Get personalized health recommendations based on your lab results and medical history.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="p-3 sm:p-4">
            <CardTitle className="text-sm sm:text-base">Medical Information</CardTitle>
          </CardHeader>
          <CardContent className="p-3 sm:p-4 pt-0">
            <p className="text-xs sm:text-sm text-muted-foreground">
              Ask about medications, symptoms, conditions, and general health topics.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

