import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router";
import {
  Activity, LayoutDashboard, Users, LogOut, Menu, X,
  Search, Stethoscope, Bell, ChevronRight,
  Droplets, Calendar, AlertTriangle, CheckCircle,
  TrendingUp, TrendingDown, Phone, Mail,
  User, Heart, Utensils, Clock,
  FileText, Send, Loader2, Plus, Trash2,
} from "lucide-react";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer,
  ReferenceLine, PieChart, Pie, Cell,
} from "recharts";
import { useAuth } from "../context/AuthContext";

// ─── Types ────────────────────────────────────────────────────────────────────
interface GlucosePoint { day: string; value: number; }
interface WeeklyAvg    { week: string; avg: number; }
interface MealPoint    { day: string; carbs: number; }
interface HbA1cPoint   { month: string; value: number; }

interface GlucoseLog {
  id: string;
  date: string;
  time: string;
  value: number;
  context: "fasting" | "after-meal" | "before-sleep" | "random";
  notes: string;
}

interface MealLog {
  id: string;
  date: string;
  time: string;
  meal: string;
  type: "breakfast" | "lunch" | "dinner" | "snack";
  carbs: number;
}

interface ClinicalNote {
  id: string;
  patientId: string;
  text: string;
  priority: "routine" | "urgent" | "critical";
  date: string;
  time: string;
  doctorName: string;
}

const NOTES_KEY = "diacheck_clinical_notes";

function loadNotes(): ClinicalNote[] {
  try { return JSON.parse(localStorage.getItem(NOTES_KEY) || "[]"); } catch { return []; }
}

function saveNotes(notes: ClinicalNote[]) {
  localStorage.setItem(NOTES_KEY, JSON.stringify(notes));
}

interface Patient {
  id: string;
  name: string;
  age: number;
  gender: string;
  dob: string;
  email: string;
  phone: string;
  diagnosis: string;
  hba1c: number;
  bmi: number;
  weight: number;
  height: number;
  medications: string[];
  riskLevel: "high" | "moderate" | "low";
  lastVisit: string;
  status: "active" | "inactive";
  avgGlucose: number;
  lastGlucose: number;
  glucoseTrend: GlucosePoint[];
  weeklyAvg: WeeklyAvg[];
  mealData: MealPoint[];
  hba1cHistory: HbA1cPoint[];
  glucoseLogs: GlucoseLog[];
  mealLogs: MealLog[];
}

// ─── Mock Patient Data ────────────────────────────────────────────────────────
const mockPatients: Patient[] = [
  {
    id: "P-2847",
    name: "John Anderson",
    age: 52,
    gender: "Male",
    dob: "Mar 15, 1972",
    email: "j.anderson@email.com",
    phone: "+1 (555) 234-5678",
    diagnosis: "Type 2 Diabetes",
    hba1c: 8.2,
    bmi: 29.4,
    weight: 87,
    height: 172,
    medications: ["Metformin 1000mg", "Glipizide 5mg"],
    riskLevel: "high",
    lastVisit: "Apr 20, 2026",
    status: "active",
    avgGlucose: 156,
    lastGlucose: 248,
    glucoseTrend: [
      { day: "Apr 17", value: 142 }, { day: "Apr 18", value: 168 }, { day: "Apr 19", value: 155 },
      { day: "Apr 20", value: 188 }, { day: "Apr 21", value: 172 }, { day: "Apr 22", value: 163 },
      { day: "Apr 23", value: 145 }, { day: "Apr 24", value: 159 }, { day: "Apr 25", value: 177 },
      { day: "Apr 26", value: 196 }, { day: "Apr 27", value: 210 }, { day: "Apr 28", value: 182 },
      { day: "Apr 29", value: 221 }, { day: "Apr 30", value: 248 },
    ],
    weeklyAvg: [
      { week: "Wk 1", avg: 148 }, { week: "Wk 2", avg: 162 },
      { week: "Wk 3", avg: 171 }, { week: "Wk 4", avg: 183 },
    ],
    mealData: [
      { day: "Mon", carbs: 65 }, { day: "Tue", carbs: 48 }, { day: "Wed", carbs: 72 },
      { day: "Thu", carbs: 55 }, { day: "Fri", carbs: 80 }, { day: "Sat", carbs: 91 }, { day: "Sun", carbs: 60 },
    ],
    hba1cHistory: [
      { month: "Nov", value: 9.1 }, { month: "Dec", value: 8.8 },
      { month: "Jan", value: 8.5 }, { month: "Feb", value: 8.4 },
      { month: "Mar", value: 8.3 }, { month: "Apr", value: 8.2 },
    ],
    glucoseLogs: [
      { id: "g1",  date: "Apr 30", time: "7:00 AM",  value: 248, context: "fasting",      notes: "Morning spike, felt dizzy" },
      { id: "g2",  date: "Apr 30", time: "12:30 PM", value: 188, context: "after-meal",   notes: "" },
      { id: "g3",  date: "Apr 29", time: "6:45 AM",  value: 221, context: "fasting",      notes: "High again" },
      { id: "g4",  date: "Apr 29", time: "1:00 PM",  value: 198, context: "after-meal",   notes: "Post-lunch reading" },
      { id: "g5",  date: "Apr 28", time: "7:15 AM",  value: 182, context: "fasting",      notes: "" },
      { id: "g6",  date: "Apr 28", time: "9:45 PM",  value: 174, context: "before-sleep", notes: "" },
      { id: "g7",  date: "Apr 27", time: "7:00 AM",  value: 210, context: "fasting",      notes: "Forgot medication yesterday" },
      { id: "g8",  date: "Apr 26", time: "6:55 AM",  value: 196, context: "fasting",      notes: "" },
      { id: "g9",  date: "Apr 25", time: "7:10 AM",  value: 177, context: "fasting",      notes: "" },
      { id: "g10", date: "Apr 24", time: "7:00 AM",  value: 159, context: "fasting",      notes: "Better this morning" },
      { id: "g11", date: "Apr 23", time: "12:00 PM", value: 193, context: "after-meal",   notes: "" },
      { id: "g12", date: "Apr 22", time: "7:05 AM",  value: 163, context: "fasting",      notes: "" },
    ],
    mealLogs: [
      { id: "m1", date: "Apr 30", time: "7:30 AM",  meal: "Scrambled eggs & white toast",     type: "breakfast", carbs: 45 },
      { id: "m2", date: "Apr 30", time: "12:45 PM", meal: "Rice, beans & fried chicken",       type: "lunch",     carbs: 95 },
      { id: "m3", date: "Apr 29", time: "8:00 AM",  meal: "Pancakes with syrup",               type: "breakfast", carbs: 110 },
      { id: "m4", date: "Apr 29", time: "1:15 PM",  meal: "Cheeseburger & fries",              type: "lunch",     carbs: 115 },
      { id: "m5", date: "Apr 28", time: "8:00 AM",  meal: "Oatmeal with banana",               type: "breakfast", carbs: 58 },
      { id: "m6", date: "Apr 28", time: "7:00 PM",  meal: "Pasta with tomato sauce & salad",   type: "dinner",    carbs: 88 },
      { id: "m7", date: "Apr 27", time: "8:15 AM",  meal: "Cereal with whole milk",             type: "breakfast", carbs: 72 },
      { id: "m8", date: "Apr 27", time: "1:00 PM",  meal: "Club sandwich & chips",             type: "lunch",     carbs: 82 },
      { id: "m9", date: "Apr 26", time: "7:45 AM",  meal: "Greek yogurt & granola",            type: "breakfast", carbs: 48 },
      { id: "m10",date: "Apr 26", time: "7:30 PM",  meal: "Grilled steak & mashed potatoes",  type: "dinner",    carbs: 55 },
    ],
  },
  {
    id: "P-1583",
    name: "Michael Chen",
    age: 44,
    gender: "Male",
    dob: "Jul 28, 1980",
    email: "m.chen@email.com",
    phone: "+1 (555) 876-4321",
    diagnosis: "Type 2 Diabetes",
    hba1c: 7.4,
    bmi: 26.8,
    weight: 78,
    height: 170,
    medications: ["Metformin 500mg"],
    riskLevel: "moderate",
    lastVisit: "Apr 25, 2026",
    status: "active",
    avgGlucose: 148,
    lastGlucose: 165,
    glucoseTrend: [
      { day: "Apr 17", value: 128 }, { day: "Apr 18", value: 144 }, { day: "Apr 19", value: 138 },
      { day: "Apr 20", value: 155 }, { day: "Apr 21", value: 149 }, { day: "Apr 22", value: 162 },
      { day: "Apr 23", value: 141 }, { day: "Apr 24", value: 153 }, { day: "Apr 25", value: 167 },
      { day: "Apr 26", value: 158 }, { day: "Apr 27", value: 144 }, { day: "Apr 28", value: 160 },
      { day: "Apr 29", value: 171 }, { day: "Apr 30", value: 165 },
    ],
    weeklyAvg: [
      { week: "Wk 1", avg: 139 }, { week: "Wk 2", avg: 145 },
      { week: "Wk 3", avg: 152 }, { week: "Wk 4", avg: 161 },
    ],
    mealData: [
      { day: "Mon", carbs: 52 }, { day: "Tue", carbs: 60 }, { day: "Wed", carbs: 45 },
      { day: "Thu", carbs: 68 }, { day: "Fri", carbs: 55 }, { day: "Sat", carbs: 74 }, { day: "Sun", carbs: 49 },
    ],
    hba1cHistory: [
      { month: "Nov", value: 8.1 }, { month: "Dec", value: 7.9 },
      { month: "Jan", value: 7.7 }, { month: "Feb", value: 7.6 },
      { month: "Mar", value: 7.5 }, { month: "Apr", value: 7.4 },
    ],
    glucoseLogs: [
      { id: "g1",  date: "Apr 30", time: "7:20 AM",  value: 165, context: "fasting",      notes: "" },
      { id: "g2",  date: "Apr 30", time: "1:00 PM",  value: 171, context: "after-meal",   notes: "Higher than usual" },
      { id: "g3",  date: "Apr 29", time: "7:05 AM",  value: 158, context: "fasting",      notes: "" },
      { id: "g4",  date: "Apr 28", time: "7:30 AM",  value: 144, context: "fasting",      notes: "Good reading" },
      { id: "g5",  date: "Apr 28", time: "12:45 PM", value: 160, context: "after-meal",   notes: "" },
      { id: "g6",  date: "Apr 27", time: "10:30 PM", value: 152, context: "before-sleep", notes: "" },
      { id: "g7",  date: "Apr 26", time: "7:15 AM",  value: 162, context: "fasting",      notes: "" },
      { id: "g8",  date: "Apr 25", time: "7:00 AM",  value: 167, context: "fasting",      notes: "Stressful week" },
      { id: "g9",  date: "Apr 24", time: "7:10 AM",  value: 153, context: "fasting",      notes: "" },
      { id: "g10", date: "Apr 23", time: "1:30 PM",  value: 141, context: "after-meal",   notes: "" },
      { id: "g11", date: "Apr 22", time: "7:00 AM",  value: 128, context: "fasting",      notes: "Best this week" },
      { id: "g12", date: "Apr 21", time: "7:05 AM",  value: 149, context: "fasting",      notes: "" },
    ],
    mealLogs: [
      { id: "m1", date: "Apr 30", time: "7:45 AM",  meal: "Boiled eggs & whole wheat toast", type: "breakfast", carbs: 38 },
      { id: "m2", date: "Apr 30", time: "12:30 PM", meal: "Grilled salmon & brown rice",     type: "lunch",     carbs: 55 },
      { id: "m3", date: "Apr 29", time: "8:00 AM",  meal: "Congee with vegetables",          type: "breakfast", carbs: 48 },
      { id: "m4", date: "Apr 29", time: "7:00 PM",  meal: "Stir-fry noodles & tofu",        type: "dinner",    carbs: 72 },
      { id: "m5", date: "Apr 28", time: "7:30 AM",  meal: "Muesli & low-fat milk",           type: "breakfast", carbs: 52 },
      { id: "m6", date: "Apr 28", time: "1:00 PM",  meal: "Chicken salad wrap",              type: "lunch",     carbs: 44 },
      { id: "m7", date: "Apr 27", time: "7:00 PM",  meal: "Steamed fish with bok choy",      type: "dinner",    carbs: 30 },
      { id: "m8", date: "Apr 26", time: "7:45 AM",  meal: "Fruit smoothie & oats",           type: "breakfast", carbs: 65 },
      { id: "m9", date: "Apr 26", time: "12:00 PM", meal: "Dim sum (steamed)",               type: "lunch",     carbs: 78 },
    ],
  },
  {
    id: "P-2156",
    name: "David Kim",
    age: 38,
    gender: "Male",
    dob: "Nov 2, 1987",
    email: "d.kim@email.com",
    phone: "+1 (555) 345-9876",
    diagnosis: "Type 1 Diabetes",
    hba1c: 6.8,
    bmi: 22.1,
    weight: 68,
    height: 175,
    medications: ["Insulin Lispro", "Insulin Glargine"],
    riskLevel: "high",
    lastVisit: "Apr 18, 2026",
    status: "active",
    avgGlucose: 98,
    lastGlucose: 52,
    glucoseTrend: [
      { day: "Apr 17", value: 112 }, { day: "Apr 18", value: 95 }, { day: "Apr 19", value: 88 },
      { day: "Apr 20", value: 104 }, { day: "Apr 21", value: 78 }, { day: "Apr 22", value: 92 },
      { day: "Apr 23", value: 115 }, { day: "Apr 24", value: 86 }, { day: "Apr 25", value: 73 },
      { day: "Apr 26", value: 109 }, { day: "Apr 27", value: 94 }, { day: "Apr 28", value: 81 },
      { day: "Apr 29", value: 68 }, { day: "Apr 30", value: 52 },
    ],
    weeklyAvg: [
      { week: "Wk 1", avg: 101 }, { week: "Wk 2", avg: 94 },
      { week: "Wk 3", avg: 98 }, { week: "Wk 4", avg: 88 },
    ],
    mealData: [
      { day: "Mon", carbs: 45 }, { day: "Tue", carbs: 52 }, { day: "Wed", carbs: 38 },
      { day: "Thu", carbs: 60 }, { day: "Fri", carbs: 42 }, { day: "Sat", carbs: 55 }, { day: "Sun", carbs: 48 },
    ],
    hba1cHistory: [
      { month: "Nov", value: 7.4 }, { month: "Dec", value: 7.2 },
      { month: "Jan", value: 7.0 }, { month: "Feb", value: 6.9 },
      { month: "Mar", value: 6.9 }, { month: "Apr", value: 6.8 },
    ],
    glucoseLogs: [
      { id: "g1",  date: "Apr 30", time: "6:30 AM",  value: 52,  context: "fasting",      notes: "⚠ Low — had juice immediately" },
      { id: "g2",  date: "Apr 30", time: "8:00 AM",  value: 88,  context: "after-meal",   notes: "Recovered after breakfast" },
      { id: "g3",  date: "Apr 29", time: "6:45 AM",  value: 68,  context: "fasting",      notes: "Borderline low" },
      { id: "g4",  date: "Apr 29", time: "2:00 PM",  value: 104, context: "after-meal",   notes: "" },
      { id: "g5",  date: "Apr 28", time: "6:50 AM",  value: 81,  context: "fasting",      notes: "" },
      { id: "g6",  date: "Apr 28", time: "10:30 PM", value: 96,  context: "before-sleep", notes: "Snacked before bed" },
      { id: "g7",  date: "Apr 27", time: "7:00 AM",  value: 94,  context: "fasting",      notes: "" },
      { id: "g8",  date: "Apr 26", time: "6:40 AM",  value: 109, context: "fasting",      notes: "" },
      { id: "g9",  date: "Apr 25", time: "1:00 PM",  value: 73,  context: "random",       notes: "Felt shaky, checked" },
      { id: "g10", date: "Apr 24", time: "6:55 AM",  value: 86,  context: "fasting",      notes: "" },
      { id: "g11", date: "Apr 23", time: "7:05 AM",  value: 115, context: "fasting",      notes: "" },
      { id: "g12", date: "Apr 22", time: "11:00 PM", value: 78,  context: "before-sleep", notes: "" },
    ],
    mealLogs: [
      { id: "m1", date: "Apr 30", time: "8:10 AM",  meal: "Orange juice & crackers (low treatment)", type: "snack",     carbs: 30 },
      { id: "m2", date: "Apr 30", time: "12:30 PM", meal: "Quinoa bowl with vegetables",              type: "lunch",     carbs: 55 },
      { id: "m3", date: "Apr 29", time: "7:00 AM",  meal: "Whole wheat toast & peanut butter",       type: "breakfast", carbs: 38 },
      { id: "m4", date: "Apr 29", time: "7:00 PM",  meal: "Grilled chicken & sweet potato",          type: "dinner",    carbs: 42 },
      { id: "m5", date: "Apr 28", time: "7:30 AM",  meal: "Greek yogurt with berries",               type: "breakfast", carbs: 28 },
      { id: "m6", date: "Apr 28", time: "1:00 PM",  meal: "Turkey & avocado sandwich",               type: "lunch",     carbs: 45 },
      { id: "m7", date: "Apr 27", time: "6:45 PM",  meal: "Brown rice & lean beef stir-fry",         type: "dinner",    carbs: 60 },
      { id: "m8", date: "Apr 27", time: "3:00 PM",  meal: "Apple & almond butter",                   type: "snack",     carbs: 25 },
    ],
  },
  {
    id: "P-3041",
    name: "Emily Rodriguez",
    age: 61,
    gender: "Female",
    dob: "Jan 9, 1965",
    email: "e.rodriguez@email.com",
    phone: "+1 (555) 512-7890",
    diagnosis: "Type 2 Diabetes",
    hba1c: 7.1,
    bmi: 28.2,
    weight: 73,
    height: 161,
    medications: ["Metformin 1000mg", "Sitagliptin 100mg"],
    riskLevel: "moderate",
    lastVisit: "Apr 28, 2026",
    status: "active",
    avgGlucose: 132,
    lastGlucose: 127,
    glucoseTrend: [
      { day: "Apr 17", value: 118 }, { day: "Apr 18", value: 131 }, { day: "Apr 19", value: 124 },
      { day: "Apr 20", value: 139 }, { day: "Apr 21", value: 128 }, { day: "Apr 22", value: 135 },
      { day: "Apr 23", value: 121 }, { day: "Apr 24", value: 142 }, { day: "Apr 25", value: 133 },
      { day: "Apr 26", value: 126 }, { day: "Apr 27", value: 138 }, { day: "Apr 28", value: 129 },
      { day: "Apr 29", value: 134 }, { day: "Apr 30", value: 127 },
    ],
    weeklyAvg: [
      { week: "Wk 1", avg: 128 }, { week: "Wk 2", avg: 133 },
      { week: "Wk 3", avg: 130 }, { week: "Wk 4", avg: 132 },
    ],
    mealData: [
      { day: "Mon", carbs: 42 }, { day: "Tue", carbs: 55 }, { day: "Wed", carbs: 38 },
      { day: "Thu", carbs: 61 }, { day: "Fri", carbs: 47 }, { day: "Sat", carbs: 53 }, { day: "Sun", carbs: 44 },
    ],
    hba1cHistory: [
      { month: "Nov", value: 7.8 }, { month: "Dec", value: 7.6 },
      { month: "Jan", value: 7.4 }, { month: "Feb", value: 7.3 },
      { month: "Mar", value: 7.2 }, { month: "Apr", value: 7.1 },
    ],
    glucoseLogs: [
      { id: "g1",  date: "Apr 30", time: "7:00 AM",  value: 127, context: "fasting",      notes: "" },
      { id: "g2",  date: "Apr 30", time: "12:15 PM", value: 134, context: "after-meal",   notes: "" },
      { id: "g3",  date: "Apr 29", time: "7:10 AM",  value: 134, context: "fasting",      notes: "" },
      { id: "g4",  date: "Apr 28", time: "7:05 AM",  value: 129, context: "fasting",      notes: "Steady progress" },
      { id: "g5",  date: "Apr 28", time: "1:30 PM",  value: 142, context: "after-meal",   notes: "" },
      { id: "g6",  date: "Apr 27", time: "10:00 PM", value: 118, context: "before-sleep", notes: "" },
      { id: "g7",  date: "Apr 26", time: "7:00 AM",  value: 126, context: "fasting",      notes: "" },
      { id: "g8",  date: "Apr 25", time: "7:20 AM",  value: 133, context: "fasting",      notes: "" },
      { id: "g9",  date: "Apr 24", time: "1:00 PM",  value: 139, context: "after-meal",   notes: "Large lunch" },
      { id: "g10", date: "Apr 23", time: "7:00 AM",  value: 121, context: "fasting",      notes: "" },
      { id: "g11", date: "Apr 22", time: "7:15 AM",  value: 128, context: "fasting",      notes: "" },
      { id: "g12", date: "Apr 21", time: "9:30 PM",  value: 115, context: "before-sleep", notes: "" },
    ],
    mealLogs: [
      { id: "m1", date: "Apr 30", time: "7:30 AM",  meal: "Oatmeal with cinnamon & almonds",        type: "breakfast", carbs: 42 },
      { id: "m2", date: "Apr 30", time: "12:30 PM", meal: "Lentil soup & whole grain bread",        type: "lunch",     carbs: 58 },
      { id: "m3", date: "Apr 29", time: "7:00 AM",  meal: "Eggs with sautéed spinach",              type: "breakfast", carbs: 12 },
      { id: "m4", date: "Apr 29", time: "7:30 PM",  meal: "Baked salmon & roasted vegetables",      type: "dinner",    carbs: 35 },
      { id: "m5", date: "Apr 28", time: "8:00 AM",  meal: "Yogurt parfait with low-sugar granola",  type: "breakfast", carbs: 48 },
      { id: "m6", date: "Apr 28", time: "1:30 PM",  meal: "Grilled chicken wrap & side salad",     type: "lunch",     carbs: 62 },
      { id: "m7", date: "Apr 27", time: "7:00 PM",  meal: "Turkey meatballs & zucchini noodles",   type: "dinner",    carbs: 28 },
      { id: "m8", date: "Apr 26", time: "3:30 PM",  meal: "Apple slices with cottage cheese",      type: "snack",     carbs: 22 },
    ],
  },
  {
    id: "P-1892",
    name: "Sarah Thompson",
    age: 29,
    gender: "Female",
    dob: "Aug 22, 1996",
    email: "s.thompson@email.com",
    phone: "+1 (555) 678-2345",
    diagnosis: "Type 1 Diabetes",
    hba1c: 6.4,
    bmi: 21.3,
    weight: 58,
    height: 165,
    medications: ["Insulin Aspart", "Insulin Detemir"],
    riskLevel: "low",
    lastVisit: "Apr 30, 2026",
    status: "active",
    avgGlucose: 108,
    lastGlucose: 103,
    glucoseTrend: [
      { day: "Apr 17", value: 102 }, { day: "Apr 18", value: 98 }, { day: "Apr 19", value: 115 },
      { day: "Apr 20", value: 107 }, { day: "Apr 21", value: 95 }, { day: "Apr 22", value: 111 },
      { day: "Apr 23", value: 104 }, { day: "Apr 24", value: 99 }, { day: "Apr 25", value: 118 },
      { day: "Apr 26", value: 108 }, { day: "Apr 27", value: 101 }, { day: "Apr 28", value: 114 },
      { day: "Apr 29", value: 96 }, { day: "Apr 30", value: 103 },
    ],
    weeklyAvg: [
      { week: "Wk 1", avg: 106 }, { week: "Wk 2", avg: 109 },
      { week: "Wk 3", avg: 107 }, { week: "Wk 4", avg: 110 },
    ],
    mealData: [
      { day: "Mon", carbs: 38 }, { day: "Tue", carbs: 45 }, { day: "Wed", carbs: 42 },
      { day: "Thu", carbs: 50 }, { day: "Fri", carbs: 35 }, { day: "Sat", carbs: 48 }, { day: "Sun", carbs: 41 },
    ],
    hba1cHistory: [
      { month: "Nov", value: 6.9 }, { month: "Dec", value: 6.8 },
      { month: "Jan", value: 6.7 }, { month: "Feb", value: 6.6 },
      { month: "Mar", value: 6.5 }, { month: "Apr", value: 6.4 },
    ],
    glucoseLogs: [
      { id: "g1",  date: "Apr 30", time: "7:00 AM",  value: 103, context: "fasting",      notes: "" },
      { id: "g2",  date: "Apr 30", time: "11:30 AM", value: 118, context: "after-meal",   notes: "" },
      { id: "g3",  date: "Apr 29", time: "6:50 AM",  value: 96,  context: "fasting",      notes: "" },
      { id: "g4",  date: "Apr 29", time: "10:00 PM", value: 101, context: "before-sleep", notes: "" },
      { id: "g5",  date: "Apr 28", time: "7:05 AM",  value: 114, context: "fasting",      notes: "" },
      { id: "g6",  date: "Apr 28", time: "1:00 PM",  value: 122, context: "after-meal",   notes: "Slightly elevated" },
      { id: "g7",  date: "Apr 27", time: "7:00 AM",  value: 95,  context: "fasting",      notes: "Great result!" },
      { id: "g8",  date: "Apr 26", time: "7:10 AM",  value: 108, context: "fasting",      notes: "" },
      { id: "g9",  date: "Apr 25", time: "12:30 PM", value: 118, context: "after-meal",   notes: "" },
      { id: "g10", date: "Apr 24", time: "6:55 AM",  value: 99,  context: "fasting",      notes: "" },
      { id: "g11", date: "Apr 23", time: "7:00 AM",  value: 104, context: "fasting",      notes: "" },
      { id: "g12", date: "Apr 22", time: "9:45 PM",  value: 111, context: "before-sleep", notes: "" },
    ],
    mealLogs: [
      { id: "m1", date: "Apr 30", time: "7:15 AM",  meal: "Smoothie bowl with berries & seeds",   type: "breakfast", carbs: 44 },
      { id: "m2", date: "Apr 30", time: "12:00 PM", meal: "Grilled tuna salad",                    type: "lunch",     carbs: 18 },
      { id: "m3", date: "Apr 29", time: "7:30 AM",  meal: "Whole wheat toast & avocado",           type: "breakfast", carbs: 35 },
      { id: "m4", date: "Apr 29", time: "7:00 PM",  meal: "Chicken & vegetable stir-fry",          type: "dinner",    carbs: 30 },
      { id: "m5", date: "Apr 28", time: "7:00 AM",  meal: "Scrambled eggs & spinach",              type: "breakfast", carbs: 8  },
      { id: "m6", date: "Apr 28", time: "1:00 PM",  meal: "Brown rice bowl & edamame",             type: "lunch",     carbs: 62 },
      { id: "m7", date: "Apr 27", time: "6:45 PM",  meal: "Baked cod & roasted sweet potato",      type: "dinner",    carbs: 40 },
      { id: "m8", date: "Apr 27", time: "3:30 PM",  meal: "Handful of mixed nuts",                 type: "snack",     carbs: 10 },
    ],
  },
  {
    id: "P-4217",
    name: "Robert Martinez",
    age: 67,
    gender: "Male",
    dob: "Feb 14, 1959",
    email: "r.martinez@email.com",
    phone: "+1 (555) 901-3456",
    diagnosis: "Type 2 Diabetes",
    hba1c: 9.1,
    bmi: 33.6,
    weight: 102,
    height: 174,
    medications: ["Metformin 1000mg", "Empagliflozin 10mg", "Dulaglutide 1.5mg"],
    riskLevel: "high",
    lastVisit: "Apr 15, 2026",
    status: "active",
    avgGlucose: 188,
    lastGlucose: 214,
    glucoseTrend: [
      { day: "Apr 17", value: 174 }, { day: "Apr 18", value: 192 }, { day: "Apr 19", value: 205 },
      { day: "Apr 20", value: 181 }, { day: "Apr 21", value: 197 }, { day: "Apr 22", value: 213 },
      { day: "Apr 23", value: 186 }, { day: "Apr 24", value: 202 }, { day: "Apr 25", value: 178 },
      { day: "Apr 26", value: 195 }, { day: "Apr 27", value: 219 }, { day: "Apr 28", value: 207 },
      { day: "Apr 29", value: 211 }, { day: "Apr 30", value: 214 },
    ],
    weeklyAvg: [
      { week: "Wk 1", avg: 179 }, { week: "Wk 2", avg: 185 },
      { week: "Wk 3", avg: 192 }, { week: "Wk 4", avg: 204 },
    ],
    mealData: [
      { day: "Mon", carbs: 88 }, { day: "Tue", carbs: 76 }, { day: "Wed", carbs: 95 },
      { day: "Thu", carbs: 82 }, { day: "Fri", carbs: 103 }, { day: "Sat", carbs: 110 }, { day: "Sun", carbs: 79 },
    ],
    hba1cHistory: [
      { month: "Nov", value: 10.2 }, { month: "Dec", value: 9.8 },
      { month: "Jan", value: 9.6 }, { month: "Feb", value: 9.4 },
      { month: "Mar", value: 9.2 }, { month: "Apr", value: 9.1 },
    ],
    glucoseLogs: [
      { id: "g1",  date: "Apr 30", time: "7:00 AM",  value: 214, context: "fasting",      notes: "Very high, discussed with doctor" },
      { id: "g2",  date: "Apr 30", time: "1:00 PM",  value: 241, context: "after-meal",   notes: "" },
      { id: "g3",  date: "Apr 29", time: "6:45 AM",  value: 211, context: "fasting",      notes: "" },
      { id: "g4",  date: "Apr 29", time: "12:30 PM", value: 228, context: "after-meal",   notes: "Large meal" },
      { id: "g5",  date: "Apr 28", time: "7:10 AM",  value: 207, context: "fasting",      notes: "" },
      { id: "g6",  date: "Apr 28", time: "10:00 PM", value: 196, context: "before-sleep", notes: "" },
      { id: "g7",  date: "Apr 27", time: "7:00 AM",  value: 219, context: "fasting",      notes: "Skipped Empagliflozin" },
      { id: "g8",  date: "Apr 26", time: "7:05 AM",  value: 195, context: "fasting",      notes: "" },
      { id: "g9",  date: "Apr 25", time: "7:15 AM",  value: 178, context: "fasting",      notes: "Lower after walk" },
      { id: "g10", date: "Apr 24", time: "1:00 PM",  value: 234, context: "after-meal",   notes: "High-carb lunch" },
      { id: "g11", date: "Apr 23", time: "7:00 AM",  value: 186, context: "fasting",      notes: "" },
      { id: "g12", date: "Apr 22", time: "7:10 AM",  value: 202, context: "fasting",      notes: "" },
    ],
    mealLogs: [
      { id: "m1", date: "Apr 30", time: "7:30 AM",  meal: "White bread & butter with orange juice",     type: "breakfast", carbs: 88 },
      { id: "m2", date: "Apr 30", time: "1:15 PM",  meal: "Large pasta portion with garlic bread",      type: "lunch",     carbs: 130 },
      { id: "m3", date: "Apr 29", time: "8:00 AM",  meal: "Pancake stack with maple syrup",             type: "breakfast", carbs: 120 },
      { id: "m4", date: "Apr 29", time: "12:30 PM", meal: "Fried rice & spring rolls",                  type: "lunch",     carbs: 118 },
      { id: "m5", date: "Apr 28", time: "7:45 AM",  meal: "Cereal (high-sugar) & full-fat milk",        type: "breakfast", carbs: 95 },
      { id: "m6", date: "Apr 28", time: "7:00 PM",  meal: "Beef stew, potatoes & dinner roll",          type: "dinner",    carbs: 100 },
      { id: "m7", date: "Apr 27", time: "8:00 AM",  meal: "Waffles with berries",                       type: "breakfast", carbs: 105 },
      { id: "m8", date: "Apr 27", time: "3:00 PM",  meal: "Chips & soda",                               type: "snack",     carbs: 80 },
      { id: "m9", date: "Apr 26", time: "1:00 PM",  meal: "Burrito bowl (large)",                       type: "lunch",     carbs: 110 },
    ],
  },
  {
    id: "P-3388",
    name: "Linda Patel",
    age: 48,
    gender: "Female",
    dob: "Oct 5, 1977",
    email: "l.patel@email.com",
    phone: "+1 (555) 432-6789",
    diagnosis: "Prediabetes",
    hba1c: 6.1,
    bmi: 25.7,
    weight: 68,
    height: 163,
    medications: ["Metformin 500mg"],
    riskLevel: "low",
    lastVisit: "Apr 27, 2026",
    status: "active",
    avgGlucose: 112,
    lastGlucose: 109,
    glucoseTrend: [
      { day: "Apr 17", value: 108 }, { day: "Apr 18", value: 115 }, { day: "Apr 19", value: 111 },
      { day: "Apr 20", value: 119 }, { day: "Apr 21", value: 106 }, { day: "Apr 22", value: 113 },
      { day: "Apr 23", value: 121 }, { day: "Apr 24", value: 107 }, { day: "Apr 25", value: 116 },
      { day: "Apr 26", value: 110 }, { day: "Apr 27", value: 114 }, { day: "Apr 28", value: 108 },
      { day: "Apr 29", value: 112 }, { day: "Apr 30", value: 109 },
    ],
    weeklyAvg: [
      { week: "Wk 1", avg: 111 }, { week: "Wk 2", avg: 113 },
      { week: "Wk 3", avg: 110 }, { week: "Wk 4", avg: 112 },
    ],
    mealData: [
      { day: "Mon", carbs: 40 }, { day: "Tue", carbs: 47 }, { day: "Wed", carbs: 35 },
      { day: "Thu", carbs: 52 }, { day: "Fri", carbs: 43 }, { day: "Sat", carbs: 58 }, { day: "Sun", carbs: 38 },
    ],
    hba1cHistory: [
      { month: "Nov", value: 6.5 }, { month: "Dec", value: 6.4 },
      { month: "Jan", value: 6.3 }, { month: "Feb", value: 6.2 },
      { month: "Mar", value: 6.2 }, { month: "Apr", value: 6.1 },
    ],
    glucoseLogs: [
      { id: "g1",  date: "Apr 30", time: "7:05 AM",  value: 109, context: "fasting",      notes: "" },
      { id: "g2",  date: "Apr 30", time: "11:45 AM", value: 121, context: "after-meal",   notes: "" },
      { id: "g3",  date: "Apr 29", time: "7:00 AM",  value: 112, context: "fasting",      notes: "" },
      { id: "g4",  date: "Apr 28", time: "7:10 AM",  value: 108, context: "fasting",      notes: "Good morning reading" },
      { id: "g5",  date: "Apr 28", time: "1:00 PM",  value: 119, context: "after-meal",   notes: "" },
      { id: "g6",  date: "Apr 27", time: "9:45 PM",  value: 106, context: "before-sleep", notes: "" },
      { id: "g7",  date: "Apr 26", time: "7:00 AM",  value: 110, context: "fasting",      notes: "" },
      { id: "g8",  date: "Apr 25", time: "7:15 AM",  value: 116, context: "fasting",      notes: "" },
      { id: "g9",  date: "Apr 24", time: "12:00 PM", value: 107, context: "after-meal",   notes: "Light lunch" },
      { id: "g10", date: "Apr 23", time: "7:05 AM",  value: 121, context: "fasting",      notes: "Slightly higher" },
      { id: "g11", date: "Apr 22", time: "7:00 AM",  value: 113, context: "fasting",      notes: "" },
      { id: "g12", date: "Apr 21", time: "10:00 PM", value: 106, context: "before-sleep", notes: "" },
    ],
    mealLogs: [
      { id: "m1", date: "Apr 30", time: "7:30 AM",  meal: "Low-fat yogurt & mixed berries",          type: "breakfast", carbs: 38 },
      { id: "m2", date: "Apr 30", time: "12:00 PM", meal: "Grilled chicken breast & steamed broccoli", type: "lunch",   carbs: 15 },
      { id: "m3", date: "Apr 29", time: "7:15 AM",  meal: "Oatmeal with flaxseeds",                  type: "breakfast", carbs: 40 },
      { id: "m4", date: "Apr 29", time: "7:00 PM",  meal: "Vegetable curry & small rice portion",    type: "dinner",    carbs: 55 },
      { id: "m5", date: "Apr 28", time: "7:30 AM",  meal: "Whole wheat toast & cottage cheese",      type: "breakfast", carbs: 32 },
      { id: "m6", date: "Apr 28", time: "12:30 PM", meal: "Lentil dal & small naan",                 type: "lunch",     carbs: 60 },
      { id: "m7", date: "Apr 27", time: "6:30 PM",  meal: "Grilled paneer & sautéed vegetables",     type: "dinner",    carbs: 24 },
      { id: "m8", date: "Apr 27", time: "3:00 PM",  meal: "Roasted chickpeas",                       type: "snack",     carbs: 20 },
    ],
  },
];

// ─── Config ───────────────────────────────────────────────────────────────────
const riskConfig = {
  high:     { bg: "bg-red-50",    text: "text-red-700",    border: "border-red-200",   dot: "bg-red-500",    label: "High Risk" },
  moderate: { bg: "bg-amber-50",  text: "text-amber-700",  border: "border-amber-200", dot: "bg-amber-500",  label: "Moderate" },
  low:      { bg: "bg-emerald-50",text: "text-emerald-700",border: "border-emerald-200",dot:"bg-emerald-500",label: "Low Risk" },
};

// ─── Glucose tooltip ─────────────────────────────────────────────────────────
const GlucoseTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const val = payload[0].value;
  const color = val >= 126 ? "#ef4444" : val < 70 ? "#3b82f6" : "#10b981";
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-lg px-3 py-2">
      <p className="text-slate-500 text-xs mb-0.5">{label}</p>
      <p className="text-sm font-bold" style={{ color }}>{val} <span className="font-normal text-slate-400">mg/dL</span></p>
    </div>
  );
};

const GenericTooltip = ({ active, payload, label, unit }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-lg px-3 py-2">
      <p className="text-slate-500 text-xs mb-0.5">{label}</p>
      <p className="text-slate-900 text-sm font-bold">{payload[0].value} <span className="font-normal text-slate-400">{unit}</span></p>
    </div>
  );
};

// ─── Write Note Modal ─────────────────────────────────────────────────────────
function WriteNoteModal({
  patient,
  onClose,
  onSave,
}: {
  patient: { id: string; name: string };
  onClose: () => void;
  onSave: (note: ClinicalNote) => void;
}) {
  const [text,     setText]     = useState("");
  const [priority, setPriority] = useState<ClinicalNote["priority"]>("routine");
  const [saving,   setSaving]   = useState(false);

  const handleSave = async () => {
    if (!text.trim()) return;
    setSaving(true);
    await new Promise(r => setTimeout(r, 700));
    const now  = new Date();
    const note: ClinicalNote = {
      id:         `note-${Date.now()}`,
      patientId:  patient.id,
      text:       text.trim(),
      priority,
      date: now.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
      time: now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
      doctorName: "Dr. Sarah Chen",
    };
    onSave(note);
    setSaving(false);
    onClose();
  };

  const priorityConfig = {
    routine:  { bg: "border-slate-200 bg-slate-50 text-slate-700",     active: "border-blue-500 bg-blue-50 text-blue-700"    },
    urgent:   { bg: "border-slate-200 bg-slate-50 text-slate-700",     active: "border-amber-500 bg-amber-50 text-amber-700" },
    critical: { bg: "border-slate-200 bg-slate-50 text-slate-700",     active: "border-red-500 bg-red-50 text-red-700"       },
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-lg z-10 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
              <FileText className="w-5 h-5 text-blue-600" strokeWidth={1.8} />
            </div>
            <div>
              <h3 className="text-slate-900 text-sm" style={{ fontWeight: 700 }}>Write Clinical Note</h3>
              <p className="text-slate-400 text-xs mt-0.5">Visible to {patient.name} immediately</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          {/* Priority */}
          <div>
            <label className="block text-sm text-slate-700 mb-2" style={{ fontWeight: 600 }}>Priority Level</label>
            <div className="grid grid-cols-3 gap-2">
              {(["routine", "urgent", "critical"] as const).map(p => (
                <button
                  key={p}
                  onClick={() => setPriority(p)}
                  className={`py-2.5 rounded-xl border text-xs capitalize transition-all ${priority === p ? priorityConfig[p].active : priorityConfig[p].bg}`}
                  style={{ fontWeight: priority === p ? 600 : 400 }}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Note text */}
          <div>
            <label className="block text-sm text-slate-700 mb-2" style={{ fontWeight: 600 }}>
              Clinical Note
              <span className="text-slate-400 font-normal ml-2">(will appear on patient dashboard)</span>
            </label>
            <textarea
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder={`e.g. Your glucose readings have been consistently high this week. Please increase water intake, avoid high-carb meals, and ensure you're taking Metformin with food. Schedule a follow-up in 2 weeks.`}
              rows={5}
              autoFocus
              className="w-full px-4 py-3 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all text-sm resize-none"
            />
            <p className="text-slate-400 text-xs mt-1.5">{text.length} characters</p>
          </div>

          {/* Info banner */}
          <div className="flex items-start gap-2.5 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
            <CheckCircle className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" strokeWidth={1.8} />
            <p className="text-blue-700 text-xs leading-relaxed">
              This note will be <strong>instantly visible</strong> on the patient's dashboard. Make sure your message is clear and actionable.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 py-4 border-t border-slate-100">
          <button onClick={onClose} className="flex-1 py-3 border border-slate-200 text-slate-600 rounded-xl text-sm font-semibold hover:bg-slate-50 transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!text.trim() || saving}
            className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2"
          >
            {saving
              ? <><Loader2 className="w-4 h-4 animate-spin" />Sending…</>
              : <><Send className="w-4 h-4" />Send Note to Patient</>
            }
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Patient List Card ────────────────────────────────────────────────────────
function PatientCard({ patient, selected, onClick }: { patient: Patient; selected: boolean; onClick: () => void }) {
  const risk = riskConfig[patient.riskLevel];
  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-4 rounded-xl border transition-all duration-150 ${
        selected
          ? "bg-blue-50 border-blue-200 shadow-sm"
          : "bg-white border-slate-100 hover:border-slate-200 hover:bg-slate-50"
      }`}
    >
      <div className="flex items-start gap-3">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-sm font-bold ${selected ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600"}`}>
          {patient.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-0.5">
            <p className={`text-sm truncate ${selected ? "text-blue-900" : "text-slate-900"}`} style={{ fontWeight: 700 }}>
              {patient.name}
            </p>
            <ChevronRight className={`w-3.5 h-3.5 flex-shrink-0 ${selected ? "text-blue-400" : "text-slate-300"}`} />
          </div>
          <p className="text-slate-400 text-xs mb-2">{patient.id} · {patient.diagnosis}</p>
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${risk.bg} ${risk.text}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${risk.dot}`} />
              {risk.label}
            </span>
            <span className="text-slate-300 text-xs">{patient.lastVisit}</span>
          </div>
        </div>
      </div>
    </button>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function PatientDetailsPage() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<Patient>(mockPatients[0]);
  const [search, setSearch] = useState("");
  const [riskFilter, setRiskFilter] = useState<"all" | "high" | "moderate" | "low">("all");
  const [logsTab, setLogsTab] = useState<"glucose" | "meal">("glucose");
  const [showWriteNote, setShowWriteNote] = useState(false);
  const [clinicalNotes, setClinicalNotes] = useState<ClinicalNote[]>(() => loadNotes());

  const handleSaveNote = (note: ClinicalNote) => {
    const updated = [note, ...clinicalNotes];
    setClinicalNotes(updated);
    saveNotes(updated);
  };

  const handleDeleteNote = (noteId: string) => {
    const updated = clinicalNotes.filter(n => n.id !== noteId);
    setClinicalNotes(updated);
    saveNotes(updated);
  };

  const patientNotes = clinicalNotes.filter(n => n.patientId === selectedPatient.id);

  const handleSignOut = () => { signOut(); navigate("/"); };

  const filtered = mockPatients.filter(p => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) || p.id.includes(search);
    const matchRisk = riskFilter === "all" || p.riskLevel === riskFilter;
    return matchSearch && matchRisk;
  });

  const p = selectedPatient;
  const risk = riskConfig[p.riskLevel];
  const hba1cTrend = p.hba1cHistory[p.hba1cHistory.length - 1].value - p.hba1cHistory[0].value;
  const glucoseBarColor = (val: number) => val >= 180 ? "#ef4444" : val >= 126 ? "#f59e0b" : "#10b981";

  return (
    <div className="flex h-screen bg-[#F7F8FC] overflow-hidden">
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-slate-900/50 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* ── Sidebar ──────────────────────────────────────────────────────────── */}
      <aside className={`fixed lg:static inset-y-0 left-0 z-50 w-60 bg-white border-r border-slate-100 flex flex-col transition-transform duration-300 ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}>
        <div className="flex items-center justify-between px-5 h-16 border-b border-slate-100 flex-shrink-0">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-teal-500 rounded-lg flex items-center justify-center">
              <Activity className="w-4 h-4 text-white" strokeWidth={2.5} />
            </div>
            <span className="text-slate-800" style={{ fontWeight: 700, fontSize: "1rem" }}>
              Dia<span className="text-blue-600">Check</span>
            </span>
          </Link>
          <button className="lg:hidden text-slate-400" onClick={() => setSidebarOpen(false)}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-4 py-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-teal-100 flex items-center justify-center text-teal-600">
              <Stethoscope className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-slate-900 text-sm truncate" style={{ fontWeight: 600 }}>{user?.name || "Dr. Sarah Chen"}</p>
              <p className="text-slate-400 text-xs">Physician</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5">
          {[
            { icon: LayoutDashboard, label: "Dashboard", path: "/dashboard/doctor", active: false },
            { icon: Users, label: "Patients", path: "/dashboard/doctor/patients", active: true },
          ].map(({ icon: Icon, label, active, path }) => (
            <button
              key={label}
              onClick={() => navigate(path)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors ${active ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"}`}
              style={{ fontWeight: active ? 600 : 400 }}
            >
              <Icon className={`w-4 h-4 ${active ? "text-blue-600" : "text-slate-400"}`} strokeWidth={1.8} />
              <span className="flex-1 text-left">{label}</span>
            </button>
          ))}
        </nav>

        <div className="px-3 py-4 border-t border-slate-100">
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-slate-500 hover:bg-red-50 hover:text-red-600 transition-colors"
          >
            <LogOut className="w-4 h-4" strokeWidth={1.8} />
            Sign Out
          </button>
        </div>
      </aside>

      {/* ── Main ─────────────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="h-14 bg-white border-b border-slate-100 flex items-center justify-between px-5 flex-shrink-0">
          <button className="lg:hidden p-2 rounded-lg hover:bg-slate-100 text-slate-500" onClick={() => setSidebarOpen(true)}>
            <Menu className="w-5 h-5" />
          </button>
          <div className="hidden lg:flex items-center gap-2 text-sm text-slate-500">
            <Users className="w-4 h-4" />
            <span style={{ fontWeight: 600 }}>Patient Records</span>
            <span className="text-slate-300">·</span>
            <span className="text-slate-400">{mockPatients.length} patients</span>
          </div>
          <button onClick={() => navigate("/dashboard/doctor")} className="flex items-center gap-2 text-sm text-blue-600 font-semibold hover:text-blue-700 transition-colors">
            <Bell className="w-4 h-4" />
            <span className="hidden sm:inline">Alerts</span>
          </button>
        </header>

        {/* Body: list + detail */}
        <div className="flex-1 flex overflow-hidden">

          {/* ── Patient List Panel ────────────────────────────────────────── */}
          <div className="w-72 xl:w-80 flex-shrink-0 bg-white border-r border-slate-100 flex flex-col overflow-hidden hidden md:flex">
            {/* Search + Filter */}
            <div className="px-4 py-4 border-b border-slate-50 space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search patients..."
                  className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 transition-all"
                />
              </div>
              <div className="flex gap-1.5 flex-wrap">
                {(["all", "high", "moderate", "low"] as const).map(r => (
                  <button
                    key={r}
                    onClick={() => setRiskFilter(r)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold capitalize transition-colors ${
                      riskFilter === r ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
              {filtered.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-sm">No patients found</div>
              ) : (
                filtered.map(patient => (
                  <PatientCard
                    key={patient.id}
                    patient={patient}
                    selected={selectedPatient.id === patient.id}
                    onClick={() => { setSelectedPatient(patient); setLogsTab("glucose"); }}
                  />
                ))
              )}
            </div>
          </div>

          {/* ── Detail Panel ──────────────────────────────────────────────── */}
          <div className="flex-1 overflow-y-auto px-5 py-6 space-y-5">

            {/* ── Patient Header ── */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <div className="flex items-start gap-4">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xl flex-shrink-0" style={{ fontWeight: 800 }}>
                  {p.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div>
                      <h1 className="text-slate-900" style={{ fontWeight: 800, fontSize: "1.3rem" }}>{p.name}</h1>
                      <p className="text-slate-400 text-sm mt-0.5">{p.id} · {p.age} yrs · {p.gender} · Born {p.dob}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-semibold ${risk.bg} ${risk.text} ${risk.border} border`}>
                        <span className={`w-2 h-2 rounded-full ${risk.dot}`} />
                        {risk.label}
                      </span>
                      <button
                        onClick={() => setShowWriteNote(true)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition-colors shadow-sm"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Write Note
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-4 mt-3 text-sm text-slate-500">
                    <div className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5 text-slate-400" />{p.email}</div>
                    <div className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5 text-slate-400" />{p.phone}</div>
                    <div className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5 text-slate-400" />Last visit: {p.lastVisit}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Key Metrics ── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                {
                  label: "Avg Glucose",
                  value: p.avgGlucose,
                  unit: "mg/dL",
                  icon: Droplets,
                  color: p.avgGlucose >= 126 ? { bg: "bg-red-50", icon: "text-red-500", val: "text-red-700" } : { bg: "bg-blue-50", icon: "text-blue-500", val: "text-blue-700" },
                },
                {
                  label: "Latest Glucose",
                  value: p.lastGlucose,
                  unit: "mg/dL",
                  icon: Activity,
                  color: p.lastGlucose >= 126 ? { bg: "bg-red-50", icon: "text-red-500", val: "text-red-700" } : p.lastGlucose < 70 ? { bg: "bg-amber-50", icon: "text-amber-500", val: "text-amber-700" } : { bg: "bg-emerald-50", icon: "text-emerald-500", val: "text-emerald-700" },
                },
                {
                  label: "HbA1c",
                  value: p.hba1c,
                  unit: "%",
                  icon: Heart,
                  color: p.hba1c >= 8 ? { bg: "bg-red-50", icon: "text-red-500", val: "text-red-700" } : p.hba1c >= 6.5 ? { bg: "bg-amber-50", icon: "text-amber-500", val: "text-amber-700" } : { bg: "bg-emerald-50", icon: "text-emerald-500", val: "text-emerald-700" },
                },
                {
                  label: "BMI",
                  value: p.bmi,
                  unit: "kg/m²",
                  icon: User,
                  color: p.bmi >= 30 ? { bg: "bg-red-50", icon: "text-red-500", val: "text-red-700" } : p.bmi >= 25 ? { bg: "bg-amber-50", icon: "text-amber-500", val: "text-amber-700" } : { bg: "bg-emerald-50", icon: "text-emerald-500", val: "text-emerald-700" },
                },
              ].map(({ label, value, unit, icon: Icon, color }) => (
                <div key={label} className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
                  <div className={`w-9 h-9 ${color.bg} rounded-xl flex items-center justify-center mb-3`}>
                    <Icon className={`w-4.5 h-4.5 ${color.icon}`} strokeWidth={1.8} />
                  </div>
                  <p className="text-slate-400 text-xs mb-0.5">{label}</p>
                  <p className={`${color.val}`} style={{ fontWeight: 800, fontSize: "1.5rem", lineHeight: 1 }}>{value}</p>
                  <p className="text-slate-400 text-xs mt-0.5">{unit}</p>
                </div>
              ))}
            </div>

            {/* ── Physical Info ── */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <h3 className="text-slate-900 text-sm mb-4" style={{ fontWeight: 700 }}>Physical Information</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: "Height",    value: `${p.height} cm` },
                  { label: "Weight",    value: `${p.weight} kg` },
                  { label: "BMI",       value: p.bmi            },
                  { label: "Diagnosis", value: p.diagnosis      },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-slate-50 rounded-xl p-3">
                    <p className="text-slate-400 text-xs mb-0.5">{label}</p>
                    <p className="text-slate-900 text-sm" style={{ fontWeight: 600 }}>{value}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Clinical Notes ── */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-slate-50">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-blue-500" strokeWidth={1.8} />
                  <h3 className="text-slate-900 text-sm" style={{ fontWeight: 700 }}>Clinical Notes</h3>
                  {patientNotes.length > 0 && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 font-semibold">{patientNotes.length}</span>
                  )}
                </div>
                <button
                  onClick={() => setShowWriteNote(true)}
                  className="flex items-center gap-1.5 text-xs text-blue-600 font-semibold hover:text-blue-700 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />Add Note
                </button>
              </div>

              {patientNotes.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 px-5 text-center">
                  <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center mb-3">
                    <FileText className="w-5 h-5 text-slate-300" strokeWidth={1.8} />
                  </div>
                  <p className="text-slate-500 text-sm" style={{ fontWeight: 600 }}>No notes yet</p>
                  <p className="text-slate-400 text-xs mt-1">Clinical notes you write will appear here and on the patient's dashboard.</p>
                  <button
                    onClick={() => setShowWriteNote(true)}
                    className="mt-4 flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />Write First Note
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-slate-50">
                  {patientNotes.map(note => {
                    const priorityCfg = {
                      routine:  { bg: "bg-blue-50",   text: "text-blue-700",   border: "border-blue-100",   dot: "bg-blue-500"   },
                      urgent:   { bg: "bg-amber-50",  text: "text-amber-700",  border: "border-amber-100",  dot: "bg-amber-500"  },
                      critical: { bg: "bg-red-50",    text: "text-red-700",    border: "border-red-100",    dot: "bg-red-500"    },
                    }[note.priority];
                    return (
                      <div key={note.id} className="px-5 py-4 hover:bg-slate-50/50 transition-colors group">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3 flex-1 min-w-0">
                            <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 ${priorityCfg.bg}`}>
                              <FileText className={`w-3.5 h-3.5 ${priorityCfg.text}`} strokeWidth={1.8} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1 flex-wrap">
                                <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border capitalize font-semibold ${priorityCfg.bg} ${priorityCfg.text} ${priorityCfg.border}`}>
                                  <span className={`w-1.5 h-1.5 rounded-full ${priorityCfg.dot}`} />{note.priority}
                                </span>
                                <span className="text-slate-400 text-xs">{note.doctorName}</span>
                                <span className="text-slate-300 text-xs">·</span>
                                <span className="text-slate-400 text-xs flex items-center gap-1">
                                  <Clock className="w-2.5 h-2.5" />{note.date} at {note.time}
                                </span>
                              </div>
                              <p className="text-slate-700 text-sm leading-relaxed">{note.text}</p>
                            </div>
                          </div>
                          <button
                            onClick={() => handleDeleteNote(note.id)}
                            className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-red-50 rounded-lg text-slate-300 hover:text-red-400 transition-all flex-shrink-0"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* ── Glucose Trend Chart ── */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h3 className="text-slate-900 text-sm" style={{ fontWeight: 700 }}>Glucose Trend</h3>
                  <p className="text-slate-400 text-xs mt-0.5">Last 14 days · mg/dL</p>
                </div>
                <div className="flex items-center gap-4 text-xs text-slate-400">
                  <div className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-emerald-400 inline-block rounded" />Normal</div>
                  <div className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-amber-400 inline-block rounded" />High</div>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={p.glucoseTrend} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="day" tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} axisLine={false} interval={2} />
                  <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} axisLine={false} domain={[40, 280]} />
                  <Tooltip content={<GlucoseTooltip />} />
                  <ReferenceLine y={126} stroke="#f59e0b" strokeDasharray="4 4" strokeWidth={1.5} label={{ value: "High", position: "right", fontSize: 9, fill: "#f59e0b" }} />
                  <ReferenceLine y={70} stroke="#3b82f6" strokeDasharray="4 4" strokeWidth={1.5} label={{ value: "Low", position: "right", fontSize: 9, fill: "#3b82f6" }} />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke="#3b82f6"
                    strokeWidth={2.5}
                    dot={(props) => {
                      const { cx, cy, payload } = props;
                      const color = payload.value >= 126 ? "#ef4444" : payload.value < 70 ? "#3b82f6" : "#10b981";
                      return <circle key={`dot-${cx}-${cy}`} cx={cx} cy={cy} r={3.5} fill={color} stroke="white" strokeWidth={1.5} />;
                    }}
                    activeDot={{ r: 5, strokeWidth: 2 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* ── Weekly Avg + Meal Carbs ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Weekly Average */}
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                <h3 className="text-slate-900 text-sm mb-1" style={{ fontWeight: 700 }}>Weekly Average Glucose</h3>
                <p className="text-slate-400 text-xs mb-5">Last 4 weeks · mg/dL</p>
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={p.weeklyAvg} margin={{ top: 0, right: 10, left: -20, bottom: 0 }} barSize={32}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="week" tick={{ fontSize: 11, fill: "#94a3b8" }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} axisLine={false} domain={[60, 250]} />
                    <Tooltip content={<GenericTooltip unit="mg/dL" />} />
                    <ReferenceLine y={126} stroke="#f59e0b" strokeDasharray="4 4" strokeWidth={1.5} />
                    <Bar dataKey="avg" radius={[6, 6, 0, 0]}>
                      {p.weeklyAvg.map((entry, i) => (
                        <Cell key={`cell-${i}`} fill={glucoseBarColor(entry.avg)} fillOpacity={0.85} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Meal Carbs */}
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                <h3 className="text-slate-900 text-sm mb-1" style={{ fontWeight: 700 }}>Daily Carb Intake</h3>
                <p className="text-slate-400 text-xs mb-5">Last 7 days · grams</p>
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={p.mealData} margin={{ top: 0, right: 10, left: -20, bottom: 0 }} barSize={28}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="day" tick={{ fontSize: 11, fill: "#94a3b8" }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} axisLine={false} domain={[0, 130]} />
                    <Tooltip content={<GenericTooltip unit="g" />} />
                    <ReferenceLine y={75} stroke="#10b981" strokeDasharray="4 4" strokeWidth={1.5} label={{ value: "Target", position: "right", fontSize: 9, fill: "#10b981" }} />
                    <Bar dataKey="carbs" fill="#10b981" fillOpacity={0.8} radius={[6, 6, 0, 0]}>
                      {p.mealData.map((entry, i) => (
                        <Cell key={`meal-${i}`} fill={entry.carbs > 75 ? "#f59e0b" : "#10b981"} fillOpacity={0.85} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* ── HbA1c History ── */}
            

            {/* ── Glucose & Meal Logs History ────────────────────────────────── */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">

              {/* Tab Header */}
              <div className="flex border-b border-slate-100">
                <button
                  onClick={() => setLogsTab("glucose")}
                  className={`flex-1 flex items-center justify-center gap-2 px-5 py-4 text-sm transition-all border-b-2 ${
                    logsTab === "glucose"
                      ? "border-blue-600 text-blue-700 bg-blue-50/40"
                      : "border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50"
                  }`}
                  style={{ fontWeight: logsTab === "glucose" ? 600 : 400 }}
                >
                  <Droplets className="w-4 h-4" strokeWidth={1.8} />
                  Glucose Logs
                  <span className={`text-xs px-2 py-0.5 rounded-full ${logsTab === "glucose" ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-400"}`}>
                    {p.glucoseLogs.length}
                  </span>
                </button>
                <button
                  onClick={() => setLogsTab("meal")}
                  className={`flex-1 flex items-center justify-center gap-2 px-5 py-4 text-sm transition-all border-b-2 ${
                    logsTab === "meal"
                      ? "border-emerald-600 text-emerald-700 bg-emerald-50/40"
                      : "border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50"
                  }`}
                  style={{ fontWeight: logsTab === "meal" ? 600 : 400 }}
                >
                  <Utensils className="w-4 h-4" strokeWidth={1.8} />
                  Meal Logs
                  <span className={`text-xs px-2 py-0.5 rounded-full ${logsTab === "meal" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-400"}`}>
                    {p.mealLogs.length}
                  </span>
                </button>
              </div>

              {/* Column Headers */}
              {logsTab === "glucose" ? (
                <>
                  <div className="grid grid-cols-4 px-5 py-2.5 bg-slate-50 border-b border-slate-100 text-xs text-slate-400" style={{ fontWeight: 600 }}>
                    <span>Date & Time</span>
                    <span>Value</span>
                    <span>Context</span>
                    <span>Notes</span>
                  </div>
                  <div className="divide-y divide-slate-50 max-h-80 overflow-y-auto">
                    {p.glucoseLogs.map(log => {
                      const isHigh = log.value >= 126;
                      const isLow  = log.value < 70;
                      const valColor  = isHigh ? "text-red-700"     : isLow ? "text-blue-700"     : "text-emerald-700";
                      const badgeCls  = isHigh ? "bg-red-50 text-red-600 border border-red-100"
                                      : isLow  ? "bg-blue-50 text-blue-600 border border-blue-100"
                                               : "bg-emerald-50 text-emerald-600 border border-emerald-100";
                      const ctxColors: Record<string, string> = {
                        "fasting":      "bg-blue-50 text-blue-700",
                        "after-meal":   "bg-amber-50 text-amber-700",
                        "before-sleep": "bg-purple-50 text-purple-700",
                        "random":       "bg-slate-100 text-slate-600",
                      };
                      return (
                        <div key={log.id} className="grid grid-cols-4 items-center px-5 py-3.5 hover:bg-slate-50/60 transition-colors gap-2">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 bg-blue-50 rounded-xl flex items-center justify-center flex-shrink-0">
                              <Droplets className="w-3.5 h-3.5 text-blue-500" strokeWidth={1.8} />
                            </div>
                            <div>
                              <p className="text-slate-700 text-xs" style={{ fontWeight: 600 }}>{log.date}</p>
                              <p className="text-slate-400 text-xs flex items-center gap-1 mt-0.5">
                                <Clock className="w-2.5 h-2.5" />{log.time}
                              </p>
                            </div>
                          </div>
                          <div>
                            <span className={`text-sm ${valColor}`} style={{ fontWeight: 700 }}>{log.value}</span>
                            <span className="text-slate-400 text-xs ml-1">mg/dL</span>
                            <div className="mt-0.5">
                              <span className={`text-xs px-1.5 py-0.5 rounded-md ${badgeCls}`} style={{ fontWeight: 600 }}>
                                {isHigh ? "High" : isLow ? "Low" : "Normal"}
                              </span>
                            </div>
                          </div>
                          <div>
                            <span className={`text-xs px-2 py-1 rounded-lg capitalize ${ctxColors[log.context]}`} style={{ fontWeight: 500 }}>
                              {log.context.replace("-", " ")}
                            </span>
                          </div>
                          <p className="text-slate-400 text-xs truncate">{log.notes || <span className="text-slate-200">—</span>}</p>
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                <>
                  <div className="grid grid-cols-4 px-5 py-2.5 bg-slate-50 border-b border-slate-100 text-xs text-slate-400" style={{ fontWeight: 600 }}>
                    <span>Date & Time</span>
                    <span className="col-span-2">Meal</span>
                    <span>Carbs</span>
                  </div>
                  <div className="divide-y divide-slate-50 max-h-80 overflow-y-auto">
                    {p.mealLogs.map(log => {
                      const isOver  = log.carbs > 75;
                      const carbColor = isOver ? "text-amber-700" : "text-emerald-700";
                      const carbBadge = isOver ? "bg-amber-50 text-amber-600 border border-amber-100" : "bg-emerald-50 text-emerald-600 border border-emerald-100";
                      const typeColors: Record<string, string> = {
                        breakfast: "bg-orange-50 text-orange-700",
                        lunch:     "bg-sky-50 text-sky-700",
                        dinner:    "bg-indigo-50 text-indigo-700",
                        snack:     "bg-pink-50 text-pink-700",
                      };
                      return (
                        <div key={log.id} className="grid grid-cols-4 items-center px-5 py-3.5 hover:bg-slate-50/60 transition-colors gap-2">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 bg-emerald-50 rounded-xl flex items-center justify-center flex-shrink-0">
                              <Utensils className="w-3.5 h-3.5 text-emerald-500" strokeWidth={1.8} />
                            </div>
                            <div>
                              <p className="text-slate-700 text-xs" style={{ fontWeight: 600 }}>{log.date}</p>
                              <p className="text-slate-400 text-xs flex items-center gap-1 mt-0.5">
                                <Clock className="w-2.5 h-2.5" />{log.time}
                              </p>
                            </div>
                          </div>
                          <div className="col-span-2 pr-2">
                            <p className="text-slate-800 text-sm truncate" style={{ fontWeight: 500 }}>{log.meal}</p>
                            <span className={`text-xs px-2 py-0.5 rounded-lg mt-0.5 inline-block capitalize ${typeColors[log.type]}`} style={{ fontWeight: 500 }}>
                              {log.type}
                            </span>
                          </div>
                          <div>
                            <span className={`text-sm ${carbColor}`} style={{ fontWeight: 700 }}>{log.carbs}g</span>
                            <div className="mt-0.5">
                              <span className={`text-xs px-1.5 py-0.5 rounded-md ${carbBadge}`} style={{ fontWeight: 600 }}>
                                {isOver ? "Over target" : "On target"}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}

              {/* Footer summary */}
              <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                {logsTab === "glucose" ? (
                  <>
                    <p className="text-slate-400 text-xs">
                      {p.glucoseLogs.length} readings · Avg{" "}
                      <span className="text-slate-700 font-semibold">
                        {Math.round(p.glucoseLogs.reduce((s, l) => s + l.value, 0) / p.glucoseLogs.length)} mg/dL
                      </span>
                    </p>
                    <p className="text-slate-400 text-xs">
                      In range:{" "}
                      <span className="text-emerald-600 font-semibold">
                        {Math.round((p.glucoseLogs.filter(l => l.value >= 70 && l.value < 126).length / p.glucoseLogs.length) * 100)}%
                      </span>
                      {" "}· High:{" "}
                      <span className="text-red-600 font-semibold">
                        {Math.round((p.glucoseLogs.filter(l => l.value >= 126).length / p.glucoseLogs.length) * 100)}%
                      </span>
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-slate-400 text-xs">
                      {p.mealLogs.length} meals logged · Avg carbs{" "}
                      <span className="text-slate-700 font-semibold">
                        {Math.round(p.mealLogs.reduce((s, l) => s + l.carbs, 0) / p.mealLogs.length)}g
                      </span>
                    </p>
                    <p className="text-slate-400 text-xs">
                      Over target:{" "}
                      <span className="text-amber-600 font-semibold">
                        {p.mealLogs.filter(l => l.carbs > 75).length} / {p.mealLogs.length} meals
                      </span>
                    </p>
                  </>
                )}
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* ── Write Note Modal ─────────────────────────────────────────────────── */}
      {showWriteNote && (
        <WriteNoteModal
          patient={{ id: selectedPatient.id, name: selectedPatient.name }}
          onClose={() => setShowWriteNote(false)}
          onSave={handleSaveNote}
        />
      )}
    </div>
  );
}
