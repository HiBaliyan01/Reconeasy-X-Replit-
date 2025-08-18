import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Trophy, Target, TrendingUp, Award, Zap, Clock, CheckCircle,
  Star, Medal, Crown, Flame, BarChart3, Activity, Users,
  Calendar, ArrowUp, ArrowDown, Minus, ChevronRight
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Progress } from './ui/progress';

interface PerformanceMetric {
  id: string;
  title: string;
  value: number;
  target: number;
  unit: string;
  trend: 'up' | 'down' | 'stable';
  trendValue: number;
  category: 'accuracy' | 'speed' | 'volume' | 'efficiency';
}

interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<any>;
  earned: boolean;
  earnedDate?: string;
  progress: number;
  maxProgress: number;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  points: number;
}

interface Leaderboard {
  rank: number;
  name: string;
  score: number;
  avatar: string;
  badge: string;
  trend: 'up' | 'down' | 'stable';
  isCurrentUser?: boolean;
}

const PerformanceInsightsDashboard: React.FC = () => {
  const [selectedPeriod, setSelectedPeriod] = useState<'day' | 'week' | 'month' | 'quarter'>('week');
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'accuracy' | 'speed' | 'volume' | 'efficiency'>('all');

  // Mock performance data
  const performanceMetrics: PerformanceMetric[] = [
    {
      id: 'accuracy',
      title: 'Reconciliation Accuracy',
      value: 98.7,
      target: 95,
      unit: '%',
      trend: 'up',
      trendValue: 2.3,
      category: 'accuracy'
    },
    {
      id: 'speed',
      title: 'Average Processing Time',
      value: 142,
      target: 180,
      unit: 'sec',
      trend: 'down',
      trendValue: -15.2,
      category: 'speed'
    },
    {
      id: 'volume',
      title: 'Records Processed',
      value: 24567,
      target: 20000,
      unit: '',
      trend: 'up',
      trendValue: 12.8,
      category: 'volume'
    },
    {
      id: 'efficiency',
      title: 'Auto-Match Rate',
      value: 87.3,
      target: 85,
      unit: '%',
      trend: 'up',
      trendValue: 4.1,
      category: 'efficiency'
    }
  ];

  const achievements: Achievement[] = [
    {
      id: 'accuracy_master',
      title: 'Accuracy Master',
      description: 'Maintain 98%+ accuracy for 7 consecutive days',
      icon: Target,
      earned: true,
      earnedDate: '2024-01-15',
      progress: 7,
      maxProgress: 7,
      rarity: 'epic',
      points: 500
    },
    {
      id: 'speed_demon',
      title: 'Speed Demon',
      description: 'Process 1000+ records in under 2 hours',
      icon: Zap,
      earned: true,
      earnedDate: '2024-01-12',
      progress: 1247,
      maxProgress: 1000,
      rarity: 'rare',
      points: 300
    },
    {
      id: 'marathon_runner',
      title: 'Marathon Runner',
      description: 'Process records for 30 consecutive days',
      icon: Calendar,
      earned: false,
      progress: 23,
      maxProgress: 30,
      rarity: 'legendary',
      points: 1000
    },
    {
      id: 'perfectionist',
      title: 'Perfectionist',
      description: 'Achieve 100% accuracy on 50 batches',
      icon: Crown,
      earned: false,
      progress: 37,
      maxProgress: 50,
      rarity: 'epic',
      points: 750
    }
  ];

  const leaderboard: Leaderboard[] = [
    { rank: 1, name: 'Sarah Chen', score: 9847, avatar: '👩‍💼', badge: 'Gold', trend: 'stable' },
    { rank: 2, name: 'You', score: 8923, avatar: '👤', badge: 'Silver', trend: 'up', isCurrentUser: true },
    { rank: 3, name: 'Mike Johnson', score: 8756, avatar: '👨‍💻', badge: 'Bronze', trend: 'down' },
    { rank: 4, name: 'Lisa Wang', score: 8234, avatar: '👩‍🔬', badge: 'Bronze', trend: 'up' },
    { rank: 5, name: 'David Kim', score: 7891, avatar: '👨‍🎓', badge: 'Bronze', trend: 'stable' }
  ];

  const userLevel = 23;
  const userXP = 8923;
  const nextLevelXP = 10000;
  const currentLevelXP = 8000;

  const filteredMetrics = selectedCategory === 'all' 
    ? performanceMetrics 
    : performanceMetrics.filter(m => m.category === selectedCategory);

  const totalPoints = achievements.filter(a => a.earned).reduce((sum, a) => sum + a.points, 0);
  const earnedAchievements = achievements.filter(a => a.earned).length;

  const getTrendIcon = (trend: 'up' | 'down' | 'stable') => {
    switch (trend) {
      case 'up': return <ArrowUp className="w-4 h-4 text-green-500" />;
      case 'down': return <ArrowDown className="w-4 h-4 text-red-500" />;
      default: return <Minus className="w-4 h-4 text-gray-500" />;
    }
  };

  const getRarityColor = (rarity: Achievement['rarity']) => {
    switch (rarity) {
      case 'common': return 'bg-gray-100 border-gray-300 text-gray-700';
      case 'rare': return 'bg-blue-50 border-blue-300 text-blue-700';
      case 'epic': return 'bg-purple-50 border-purple-300 text-purple-700';
      case 'legendary': return 'bg-yellow-50 border-yellow-400 text-yellow-800';
    }
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-700 dark:to-purple-700 rounded-xl p-6 text-white"
      >
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">Performance Insights</h1>
            <p className="text-blue-100">Track your reconciliation performance and achievements</p>
          </div>
          <div className="text-right">
            <div className="flex items-center space-x-2 mb-2">
              <Crown className="w-6 h-6 text-yellow-300" />
              <span className="text-2xl font-bold">Level {userLevel}</span>
            </div>
            <div className="w-32 bg-white/20 rounded-full h-2 mb-1">
              <div 
                className="bg-yellow-300 h-2 rounded-full transition-all duration-500"
                style={{ width: `${((userXP - currentLevelXP) / (nextLevelXP - currentLevelXP)) * 100}%` }}
              />
            </div>
            <p className="text-sm text-blue-100">{userXP - currentLevelXP} / {nextLevelXP - currentLevelXP} XP</p>
          </div>
        </div>
      </motion.div>

      {/* Quick Stats */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-1 md:grid-cols-4 gap-4"
      >
        <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-green-600 font-medium">Total Points</p>
                <p className="text-2xl font-bold text-green-800">{totalPoints.toLocaleString()}</p>
              </div>
              <Trophy className="w-8 h-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-50 to-cyan-50 border-blue-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-600 font-medium">Achievements</p>
                <p className="text-2xl font-bold text-blue-800">{earnedAchievements}/{achievements.length}</p>
              </div>
              <Award className="w-8 h-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-pink-50 border-purple-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-purple-600 font-medium">Leaderboard</p>
                <p className="text-2xl font-bold text-purple-800">#2</p>
              </div>
              <Medal className="w-8 h-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-50 to-red-50 border-orange-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-orange-600 font-medium">Streak</p>
                <p className="text-2xl font-bold text-orange-800">7 days</p>
              </div>
              <Flame className="w-8 h-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Performance Metrics */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="lg:col-span-2 space-y-4"
        >
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center space-x-2">
                  <BarChart3 className="w-5 h-5" />
                  <span>Performance Metrics</span>
                </CardTitle>
                <div className="flex space-x-2">
                  {['day', 'week', 'month', 'quarter'].map((period) => (
                    <button
                      key={period}
                      onClick={() => setSelectedPeriod(period as any)}
                      className={`px-3 py-1 rounded-lg text-sm transition-colors ${
                        selectedPeriod === period
                          ? 'bg-blue-500 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {period.charAt(0).toUpperCase() + period.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {filteredMetrics.map((metric, index) => (
                <motion.div
                  key={metric.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 + index * 0.1 }}
                  className="p-4 rounded-lg border bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-700"
                >
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium">{metric.title}</h4>
                    <div className="flex items-center space-x-2">
                      {getTrendIcon(metric.trend)}
                      <span className={`text-sm font-medium ${
                        metric.trend === 'up' ? 'text-green-600' : 
                        metric.trend === 'down' ? 'text-red-600' : 'text-gray-600'
                      }`}>
                        {metric.trend === 'up' ? '+' : metric.trend === 'down' ? '' : ''}{metric.trendValue}%
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-2xl font-bold">
                      {metric.value.toLocaleString()}{metric.unit}
                    </span>
                    <span className="text-sm text-gray-500">
                      Target: {metric.target.toLocaleString()}{metric.unit}
                    </span>
                  </div>
                  <Progress 
                    value={Math.min((metric.value / metric.target) * 100, 100)} 
                    className="h-2"
                  />
                </motion.div>
              ))}
            </CardContent>
          </Card>
        </motion.div>

        {/* Achievements & Leaderboard */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
          className="space-y-4"
        >
          {/* Recent Achievements */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Trophy className="w-5 h-5" />
                <span>Achievements</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {achievements.slice(0, 4).map((achievement, index) => (
                <motion.div
                  key={achievement.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.4 + index * 0.1 }}
                  className={`p-3 rounded-lg border-2 ${getRarityColor(achievement.rarity)} ${
                    achievement.earned ? 'opacity-100' : 'opacity-60'
                  }`}
                >
                  <div className="flex items-start space-x-3">
                    <div className={`p-2 rounded-lg ${achievement.earned ? 'bg-white' : 'bg-gray-100'}`}>
                      <achievement.icon className={`w-5 h-5 ${achievement.earned ? 'text-yellow-500' : 'text-gray-400'}`} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <h5 className="font-medium">{achievement.title}</h5>
                        <Badge variant={achievement.earned ? 'default' : 'secondary'} className="text-xs">
                          {achievement.points} pts
                        </Badge>
                      </div>
                      <p className="text-xs text-gray-600 mt-1">{achievement.description}</p>
                      {!achievement.earned && (
                        <div className="mt-2">
                          <div className="flex justify-between text-xs text-gray-500 mb-1">
                            <span>Progress</span>
                            <span>{achievement.progress}/{achievement.maxProgress}</span>
                          </div>
                          <Progress 
                            value={(achievement.progress / achievement.maxProgress) * 100} 
                            className="h-1"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </CardContent>
          </Card>

          {/* Leaderboard */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Users className="w-5 h-5" />
                <span>Leaderboard</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {leaderboard.map((user, index) => (
                <motion.div
                  key={user.rank}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.5 + index * 0.1 }}
                  className={`flex items-center justify-between p-3 rounded-lg ${
                    user.isCurrentUser ? 'bg-blue-50 border border-blue-200' : 'bg-gray-50'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <div className="flex items-center space-x-2">
                      <span className="text-lg font-bold w-6">{user.rank}</span>
                      <span className="text-2xl">{user.avatar}</span>
                    </div>
                    <div>
                      <p className="font-medium">{user.name}</p>
                      <p className="text-sm text-gray-500">{user.score.toLocaleString()} pts</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge variant={user.rank === 1 ? 'default' : 'secondary'}>
                      {user.badge}
                    </Badge>
                    {getTrendIcon(user.trend)}
                  </div>
                </motion.div>
              ))}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
};

export default PerformanceInsightsDashboard;