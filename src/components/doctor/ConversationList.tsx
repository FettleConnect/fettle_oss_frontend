import React from 'react';
import { Conversation } from '@/types/dermatology';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { User, Clock, DollarSign } from 'lucide-react';

interface ConversationListProps {
  conversations: Conversation[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  filter: 'all' | 'paid' | 'unpaid' | 'active' | 'completed';
}

export const ConversationList: React.FC<ConversationListProps> = ({
  conversations,
  selectedId,
  onSelect,
  filter,
}) => {
  const filteredConversations = conversations.filter(conv => {
    if (filter === 'paid') return conv.paymentStatus === 'paid';
    if (filter === 'unpaid') return conv.paymentStatus === 'unpaid';
    if (filter === 'active') return conv.status === 'active';
    if (filter === 'completed') return conv.status === 'completed';
    return true;
  });

  if (filteredConversations.length === 0) {
    return (
      <div className="p-4 text-center text-muted-foreground text-sm">
        No conversations found
      </div>
    );
  }

  return (
    <div className="space-y-2 p-2">
      {filteredConversations.map(conv => (
        <Card
          key={conv.id}
          className={cn(
            'p-3 cursor-pointer transition-colors hover:bg-muted/50',
            selectedId === conv.id && 'bg-muted border-primary'
          )}
          onClick={() => onSelect(conv.id)}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <User className="h-4 w-4 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="font-medium text-sm truncate">{conv.patientName}</p>
                <p className="text-xs text-muted-foreground truncate">{conv.patientEmail}</p>
              </div>
            </div>
            <div className="flex flex-col items-end gap-1">
              <Badge variant={conv.paymentStatus === 'paid' ? 'default' : 'secondary'} className="text-xs">
                {conv.paymentStatus === 'paid' ? (
                  <><DollarSign className="h-3 w-3 mr-0.5" />Paid</>
                ) : (
                  'Unpaid'
                )}
              </Badge>
              <Badge variant={conv.status === 'active' ? 'outline' : 'secondary'} className="text-xs">
                {conv.status}
              </Badge>
            </div>
          </div>
          {conv.updatedAt && (
            <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              <span>{conv.updatedAt.toLocaleDateString()}</span>
            </div>
          )}
        </Card>
      ))}
    </div>
  );
};
