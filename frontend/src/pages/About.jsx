import React from 'react';
import { motion } from 'framer-motion';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import {
  Bed,
  Users,
  TrendingUp,
  Clock,
  Shield,
  Zap,
  Linkedin,
  Mail
} from 'lucide-react';

export default function About() {
  const useCases = [
    {
      icon: <Bed className="h-8 w-8 text-blue-400" />,
      title: "Streamlined Bed Tracking",
      description: "Eliminate manual bed tracking errors with automated real-time status updates. Hospital staff can instantly see which beds are available, occupied, or being cleaned without phone calls or paperwork."
    },
    {
      icon: <Users className="h-8 w-8 text-purple-400" />,
      title: "Role-Based Workflows",
      description: "From ER staff needing emergency bed access to managers planning discharge schedules, each user role has a custom interface designed for their specific workflow needs."
    },
    {
      icon: <TrendingUp className="h-8 w-8 text-green-400" />,
      title: "Smart Forecasting",
      description: "Predict future bed availability using machine learning models trained on your hospital's occupancy patterns. Plan ahead for peak periods and optimize staff scheduling."
    },
    {
      icon: <Clock className="h-8 w-8 text-yellow-400" />,
      title: "Efficient Patient Flow",
      description: "Reduce wait times by coordinating patient admissions with expected discharges. Track estimated discharge times and plan incoming patient placements accordingly."
    },
    {
      icon: <Shield className="h-8 w-8 text-red-400" />,
      title: "Data-Driven Insights",
      description: "Access comprehensive analytics on bed utilization, turnover times, and financial performance. Export detailed reports for hospital administration and stakeholders."
    },
    {
      icon: <Zap className="h-8 w-8 text-cyan-400" />,
      title: "Instant Communication",
      description: "Critical updates reach all relevant staff members immediately through live notifications. No more delays in communicating bed availability during emergencies."
    }
  ];

  const developers = [
    {
      name: "Diganta Sen",
      rollNo: "2025201050",
      linkedin: "https://www.linkedin.com/in/diganta-sen-b9173620b/",
      image: "/team/diganta.jpg"
    },
    {
      name: "Shubham Kumar Sunny",
      rollNo: "2025201025",
      linkedin: "https://www.linkedin.com/in/shubham-kumar-sunny-4721b8228/",
      image: "/team/shubham.jpeg"
    },
    {
      name: "Surjit Mandal",
      rollNo: "2025201057",
      linkedin: "https://www.linkedin.com/in/surjit-mandal-66486b284/",
      image: "/team/surjit.jpg"
    },
    {
      name: "Nilkanta Karak",
      rollNo: "2025201031",
      linkedin: "https://www.linkedin.com/in/nilkanta-karak07/",
      image: "/team/nilkanta.jpg"
    },
    {
      name: "Abhinav Borah",
      rollNo: "2025204042",
      linkedin: "https://www.linkedin.com/in/abhinavborah/",
      image: "/team/abhinav.jpg"
    }
  ];

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Hero Section */}
      <div className="relative overflow-hidden bg-gradient-to-br from-neutral-950 via-neutral-900 to-black border-b border-neutral-800">
        <div className="absolute inset-0 bg-grid-white/[0.02] bg-[size:50px_50px]" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-32 pb-20">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center"
          >
            <h1 className="text-5xl md:text-6xl font-bold mb-6 pb-3 leading-tight bg-gradient-to-r from-blue-400 via-cyan-400 to-purple-400 bg-clip-text text-transparent overflow-visible">
              Transforming Hospital Operations
            </h1>
            <p className="text-xl text-neutral-400 max-w-3xl mx-auto leading-relaxed">
              BedManager revolutionizes hospital bed management by providing real-time visibility,
              predictive analytics, and seamless coordination between departments. Built to solve
              the daily challenges faced by healthcare professionals in managing bed availability
              and patient flow.
            </p>
          </motion.div>
        </div>
      </div>

      {/* Use Cases Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          <h2 className="text-4xl font-bold text-center mb-4 text-white">
            Why Choose BedManager?
          </h2>
          <p className="text-center text-neutral-400 mb-12 max-w-2xl mx-auto">
            Our platform addresses the critical challenges hospitals face in bed management,
            from emergency admissions to discharge planning and everything in between.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {useCases.map((useCase, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 + index * 0.1 }}
              >
                <Card className="h-full bg-neutral-900/50 border-neutral-800 hover:border-neutral-700 transition-all hover:shadow-lg hover:shadow-neutral-700/20">
                  <CardContent className="p-6 text-left">
                    <div className="flex items-start space-x-4">
                      <div className="flex-shrink-0 p-3 bg-neutral-800/50 rounded-lg">
                        {useCase.icon}
                      </div>
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-white mb-2 text-left">
                          {useCase.title}
                        </h3>
                        <p className="text-neutral-400 text-sm leading-relaxed text-left">
                          {useCase.description}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Developers Section */}
      <div className="bg-neutral-950 border-t border-neutral-800 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
          >
            <h2 className="text-4xl font-bold text-center mb-4 text-white">
              Meet the Team
            </h2>
            <p className="text-center text-neutral-400 mb-12 max-w-2xl mx-auto">
              Built by a dedicated team of developers passionate about creating solutions
              that make a real difference in healthcare.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6 justify-items-center">
              {developers.map((dev, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.5 + index * 0.1 }}
                  className="group w-full max-w-[220px]"
                >
                  <Card className="bg-neutral-900/50 border-neutral-800 hover:border-neutral-700 transition-all hover:shadow-xl hover:shadow-neutral-700/20 overflow-hidden h-full">
                    <CardContent className="p-6 text-center flex flex-col items-center">
                      {/* Profile Image */}
                      <div className="relative mx-auto w-24 h-24 mb-4 rounded-full overflow-hidden bg-gradient-to-br from-blue-500 via-purple-500 to-cyan-500 p-[2px]">
                        <div className="w-full h-full rounded-full overflow-hidden bg-neutral-800">
                          <img
                            src={dev.image}
                            alt={dev.name}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              e.target.onerror = null;
                              e.target.style.display = 'none';
                              e.target.parentElement.innerHTML = '<div class="w-full h-full flex items-center justify-center"><svg class="h-12 w-12 text-neutral-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg></div>';
                            }}
                          />
                        </div>
                      </div>

                      <h3 className="text-sm font-semibold text-white mb-1 whitespace-nowrap">
                        {dev.name}
                      </h3>
                      <p className="text-xs text-neutral-500 mb-3 font-mono">
                        {dev.rollNo}
                      </p>

                      <a
                        href={dev.linkedin}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center space-x-2 text-blue-400 hover:text-blue-300 transition-colors text-sm"
                      >
                        <Linkedin className="h-4 w-4" />
                        <span>LinkedIn</span>
                      </a>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>

      {/* Technology Stack Summary */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="text-center"
        >
          <h2 className="text-3xl font-bold mb-6 text-white">
            The Impact We're Making
          </h2>
          <p className="text-neutral-400 max-w-3xl mx-auto leading-relaxed mb-8">
            BedManager was created to address a real problem: the inefficiency and communication gaps
            in hospital bed management. By providing instant visibility and intelligent coordination,
            we help hospitals reduce patient wait times, optimize bed utilization, minimize staff
            coordination overhead, and ultimately improve patient care outcomes.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            {['Reduced Wait Times', 'Improved Efficiency', 'Better Coordination', 'Data-Driven Decisions', 'Enhanced Patient Care'].map((feature, i) => (
              <span key={i} className="px-4 py-2 bg-neutral-800/50 border border-neutral-700 rounded-full text-sm text-neutral-300">
                {feature}
              </span>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
