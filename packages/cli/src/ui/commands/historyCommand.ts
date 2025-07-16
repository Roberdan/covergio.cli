/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { SlashCommand } from './types.js';

/**
 * Command history and favorites management
 */
export const historyCommand: SlashCommand = {
  name: 'history',
  description: 'Command history and favorites management',
  subCommands: [
    {
      name: 'show',
      altName: 'list',
      description: 'Show command history',
      action: async (context, args) => {
        const limit = parseInt(args.trim()) || 20;
        const historyService = context.services.history;
        
        if (!historyService) {
          return {
            type: 'message',
            messageType: 'error',
            content: 'History service not available.'
          };
        }

        try {
          const history = await historyService.getHistory(limit);
          
          if (history.length === 0) {
            return {
              type: 'message',
              messageType: 'info',
              content: 'No command history available.'
            };
          }

          const historyList = history.map((item: any, index: number) => {
            const timeAgo = getTimeAgo(item.timestamp);
            const status = item.success ? '✅' : '❌';
            const favorite = item.favorite ? '⭐' : '';
            
            return `${String(index + 1).padStart(2, ' ')}. ${status} ${favorite} ${item.command}
     ${timeAgo} ${item.duration ? `(${item.duration}ms)` : ''}`;
          }).join('\n');

          return {
            type: 'message',
            messageType: 'info',
            content: `Command History (${history.length} most recent):\n\n${historyList}\n\nUse /history run <number> to repeat a command\nUse /history favorite <number> to mark as favorite`
          };
        } catch (error) {
          return {
            type: 'message',
            messageType: 'error',
            content: `Failed to get command history: ${(error as Error).message}`
          };
        }
      }
    },
    {
      name: 'run',
      altName: 'r',
      description: 'Run a command from history by number',
      action: async (context, args) => {
        const historyNumber = parseInt(args.trim());
        if (isNaN(historyNumber) || historyNumber < 1) {
          return {
            type: 'message',
            messageType: 'error',
            content: 'Usage: /history run <number>\nExample: /history run 5'
          };
        }

        const historyService = context.services.history;
        if (!historyService) {
          return {
            type: 'message',
            messageType: 'error',
            content: 'History service not available.'
          };
        }

        try {
          const history = await historyService.getHistory(50);
          const command = history[historyNumber - 1];
          
          if (!command) {
            return {
              type: 'message',
              messageType: 'error',
              content: `Command ${historyNumber} not found in history. Use /history show to see available commands.`
            };
          }

          // Execute the command
          return {
            type: 'command',
            command: command.command,
            addToHistory: true
          };
        } catch (error) {
          return {
            type: 'message',
            messageType: 'error',
            content: `Failed to run command from history: ${(error as Error).message}`
          };
        }
      }
    },
    {
      name: 'search',
      altName: 'find',
      description: 'Search command history',
      action: async (context, args) => {
        const searchTerm = args.trim();
        if (!searchTerm) {
          return {
            type: 'message',
            messageType: 'error',
            content: 'Usage: /history search <search-term>\nExample: /history search "agents list"'
          };
        }

        const historyService = context.services.history;
        if (!historyService) {
          return {
            type: 'message',
            messageType: 'error',
            content: 'History service not available.'
          };
        }

        try {
          const results = await historyService.searchHistory(searchTerm);
          
          if (results.length === 0) {
            return {
              type: 'message',
              messageType: 'info',
              content: `No commands found matching "${searchTerm}".`
            };
          }

          const resultsList = results.map((item: any, index: number) => {
            const timeAgo = getTimeAgo(item.timestamp);
            const status = item.success ? '✅' : '❌';
            const favorite = item.favorite ? '⭐' : '';
            
            return `${String(index + 1).padStart(2, ' ')}. ${status} ${favorite} ${item.command}
     ${timeAgo} ${item.duration ? `(${item.duration}ms)` : ''}`;
          }).join('\n');

          return {
            type: 'message',
            messageType: 'info',
            content: `Search Results for "${searchTerm}" (${results.length} found):\n\n${resultsList}\n\nUse /history run <number> to repeat a command`
          };
        } catch (error) {
          return {
            type: 'message',
            messageType: 'error',
            content: `Failed to search command history: ${(error as Error).message}`
          };
        }
      }
    },
    {
      name: 'favorite',
      altName: 'fav',
      description: 'Mark a command as favorite or show favorites',
      action: async (context, args) => {
        const historyService = context.services.history;
        if (!historyService) {
          return {
            type: 'message',
            messageType: 'error',
            content: 'History service not available.'
          };
        }

        const arg = args.trim();
        
        if (!arg) {
          // Show favorites
          try {
            const favorites = await historyService.getFavorites();
            
            if (favorites.length === 0) {
              return {
                type: 'message',
                messageType: 'info',
                content: 'No favorite commands yet. Use /history favorite <number> to mark commands as favorites.'
              };
            }

            const favoritesList = favorites.map((item: any, index: number) => {
              const timeAgo = getTimeAgo(item.timestamp);
              const status = item.success ? '✅' : '❌';
              
              return `${String(index + 1).padStart(2, ' ')}. ${status} ⭐ ${item.command}
     Added ${timeAgo} - Used ${item.useCount} times`;
            }).join('\n');

            return {
              type: 'message',
              messageType: 'info',
              content: `Favorite Commands (${favorites.length}):\n\n${favoritesList}\n\nUse /history run <number> to execute a favorite`
            };
          } catch (error) {
            return {
              type: 'message',
              messageType: 'error',
              content: `Failed to get favorites: ${(error as Error).message}`
            };
          }
        }

        // Mark command as favorite
        const historyNumber = parseInt(arg);
        if (isNaN(historyNumber) || historyNumber < 1) {
          return {
            type: 'message',
            messageType: 'error',
            content: 'Usage: /history favorite <number>\nExample: /history favorite 5'
          };
        }

        try {
          const history = await historyService.getHistory(50);
          const command = history[historyNumber - 1];
          
          if (!command) {
            return {
              type: 'message',
              messageType: 'error',
              content: `Command ${historyNumber} not found in history.`
            };
          }

          await historyService.markAsFavorite(command.id);
          
          return {
            type: 'message',
            messageType: 'success',
            content: `Command "${command.command}" marked as favorite ⭐`
          };
        } catch (error) {
          return {
            type: 'message',
            messageType: 'error',
            content: `Failed to mark command as favorite: ${(error as Error).message}`
          };
        }
      }
    },
    {
      name: 'unfavorite',
      description: 'Remove a command from favorites',
      action: async (context, args) => {
        const historyNumber = parseInt(args.trim());
        if (isNaN(historyNumber) || historyNumber < 1) {
          return {
            type: 'message',
            messageType: 'error',
            content: 'Usage: /history unfavorite <number>\nExample: /history unfavorite 3'
          };
        }

        const historyService = context.services.history;
        if (!historyService) {
          return {
            type: 'message',
            messageType: 'error',
            content: 'History service not available.'
          };
        }

        try {
          const favorites = await historyService.getFavorites();
          const command = favorites[historyNumber - 1];
          
          if (!command) {
            return {
              type: 'message',
              messageType: 'error',
              content: `Favorite ${historyNumber} not found. Use /history favorite to see favorites.`
            };
          }

          await historyService.removeFromFavorites(command.id);
          
          return {
            type: 'message',
            messageType: 'success',
            content: `Command "${command.command}" removed from favorites.`
          };
        } catch (error) {
          return {
            type: 'message',
            messageType: 'error',
            content: `Failed to remove from favorites: ${(error as Error).message}`
          };
        }
      }
    },
    {
      name: 'clear',
      description: 'Clear command history',
      action: async (context, args) => {
        const confirmFlag = args.trim();
        
        if (confirmFlag !== '--confirm') {
          return {
            type: 'message',
            messageType: 'warning',
            content: 'This will permanently delete all command history.\nUse /history clear --confirm to proceed.'
          };
        }

        const historyService = context.services.history;
        if (!historyService) {
          return {
            type: 'message',
            messageType: 'error',
            content: 'History service not available.'
          };
        }

        try {
          await historyService.clearHistory();
          
          return {
            type: 'message',
            messageType: 'success',
            content: 'Command history cleared successfully.'
          };
        } catch (error) {
          return {
            type: 'message',
            messageType: 'error',
            content: `Failed to clear history: ${(error as Error).message}`
          };
        }
      }
    },
    {
      name: 'stats',
      description: 'Show command usage statistics',
      action: async (context) => {
        const historyService = context.services.history;
        if (!historyService) {
          return {
            type: 'message',
            messageType: 'error',
            content: 'History service not available.'
          };
        }

        try {
          const stats = await historyService.getStats();
          
          const topCommands = stats.topCommands.map((cmd: any, index: number) => 
            `${String(index + 1).padStart(2, ' ')}. ${cmd.command} (${cmd.count} times)`
          ).join('\n');

          const recentActivity = stats.recentActivity.map((activity: any) => 
            `${activity.date}: ${activity.count} commands`
          ).join('\n');

          return {
            type: 'message',
            messageType: 'info',
            content: `Command Usage Statistics:

Total Commands: ${stats.totalCommands}
Unique Commands: ${stats.uniqueCommands}
Success Rate: ${(stats.successRate * 100).toFixed(1)}%
Average Duration: ${stats.averageDuration}ms
Favorites: ${stats.favoritesCount}

Top Commands:
${topCommands}

Recent Activity (last 7 days):
${recentActivity}

Total Session Time: ${Math.round(stats.totalSessionTime / 1000 / 60)}m
Most Active Hour: ${stats.mostActiveHour}:00`
          };
        } catch (error) {
          return {
            type: 'message',
            messageType: 'error',
            content: `Failed to get statistics: ${(error as Error).message}`
          };
        }
      }
    },
    {
      name: 'export',
      description: 'Export command history to file',
      action: async (context, args) => {
        const options = parseExportOptions(args);
        const historyService = context.services.history;
        
        if (!historyService) {
          return {
            type: 'message',
            messageType: 'error',
            content: 'History service not available.'
          };
        }

        try {
          const exportPath = await historyService.exportHistory({
            format: options.format || 'json',
            includeTimestamps: options.timestamps !== false,
            includeFavorites: options.favorites !== false,
            outputPath: options.output
          });
          
          return {
            type: 'message',
            messageType: 'success',
            content: `Command history exported to: ${exportPath}`
          };
        } catch (error) {
          return {
            type: 'message',
            messageType: 'error',
            content: `Failed to export history: ${(error as Error).message}`
          };
        }
      }
    }
  ]
};

/**
 * Calculate time ago from timestamp
 */
function getTimeAgo(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return 'just now';
}

/**
 * Parse export options
 */
function parseExportOptions(args: string): {
  format?: string;
  timestamps?: boolean;
  favorites?: boolean;
  output?: string;
} {
  const options: any = {};
  const parts = args.split(' ');

  for (const part of parts) {
    if (part.startsWith('--format=')) {
      options.format = part.substring(9);
    } else if (part.startsWith('--output=')) {
      options.output = part.substring(9);
    } else if (part === '--no-timestamps') {
      options.timestamps = false;
    } else if (part === '--no-favorites') {
      options.favorites = false;
    }
  }

  return options;
}