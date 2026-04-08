import React, { useEffect, useMemo } from 'react';
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

const STORAGE_KEY = 'doctor-selected-conversation-id';

const toSafeId = (value: unknown): string => String(value ?? '');

const formatSafeDate = (value: unknown): string => {
  if (!value) return '';

  const date =
    value instanceof Date
      ? value
      : typeof value === 'string' || typeof value === 'number'
      ? new Date(value)
      : null;

  if (!date || Number.isNaN(date.getTime())) return '';

  return date.toLocaleDateString();
};

export const ConversationList: React.FC<ConversationListProps> = ({
  conversations,
  selectedId,
  onSelect,
  filter,
}) => {
  const filteredConversations = useMemo(() => {
    return conversations.filter((conv) => {
      if (filter === 'paid') return conv.paymentStatus === 'paid';
      if (filter === 'unpaid') return conv.paymentStatus === 'unpaid';
      if (filter === 'active') return conv.status === 'active';
      if (filter === 'completed') return conv.status === 'completed';
      return true;
    });
  }, [conversations, filter]);

  useEffect(() => {
    if (selectedId) {
      localStorage.setItem(STORAGE_KEY, selectedId);
    }
  }, [selectedId]);

  useEffect(() => {
    if (selectedId) return;
    if (!filteredConversations.length) return;

    const savedId = localStorage.getItem(STORAGE_KEY);

    if (savedId) {
      const matchedConversation = filteredConversations.find(
        (conv) => toSafeId(conv.id) === savedId
      );

      if (matchedConversation) {
        onSelect(toSafeId(matchedConversation.id));
        return;
      }
    }

    onSelect(toSafeId(filteredConversations[0].id));
  }, [selectedId, filteredConversations, onSelect]);

  if (filteredConversations.length === 0) {
    return (
      <div className="p-4 text-center text-muted-foreground text-sm">
        No conversations found
      </div>
    );
  }

  return (
    <div className="space-y-2 p-2">
      {filteredConversations.map((conv) => {
        const convId = toSafeId(conv.id);
        const isSelected = toSafeId(selectedId) === convId;
        const formattedDate = formatSafeDate(conv.updatedAt);

        return (
          <Card
            key={convId}
            className={cn(
              'p-3 cursor-pointer transition-colors hover:bg-muted/50',
              isSelected && 'bg-muted border-primary'
            )}
            onClick={() => onSelect(convId)}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <div className="relative">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <User className="h-4 w-4 text-primary" />
                  </div>
                  {!conv.is_read && (
                    <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-blue-600 rounded-full border-2 border-background" />
                  )}
                </div>

                <div className="min-w-0">
                  <p
                    className={cn(
                      'text-sm truncate',
                      !conv.is_read ? 'font-bold' : 'font-medium'
                    )}
                  >
                    {conv.patientName}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {conv.patientEmail}
                  </p>
                </div>
              </div>

              <div className="flex flex-col items-end gap-1">
                <Badge
                  variant={conv.paymentStatus === 'paid' ? 'default' : 'secondary'}
                  className="text-xs"
                >
                  {conv.paymentStatus === 'paid' ? (
                    <>
                      <DollarSign className="h-3 w-3 mr-0.5" />
                      Paid
                    </>
                  ) : (
                    'Unpaid'
                  )}
                </Badge>

                <Badge
                  variant={conv.status === 'active' ? 'outline' : 'secondary'}
                  className="text-xs"
                >
                  {conv.status}
                </Badge>
              </div>
            </div>

            {formattedDate && (
              <div className="flex items-center gap-1 mt-2 text-xs text-black">
                <Clock className="h-3 w-3 text-black" />
                <span className="text-black">{formattedDate}</span>
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
};
