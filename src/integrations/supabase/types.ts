export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      agency_audit_log: {
        Row: {
          action: string;
          actor_user_id: string | null;
          context: Json;
          created_at: string;
          id: string;
          target_id: string | null;
          target_type: string | null;
          workspace_uuid: string;
        };
        Insert: {
          action: string;
          actor_user_id?: string | null;
          context?: Json;
          created_at?: string;
          id?: string;
          target_id?: string | null;
          target_type?: string | null;
          workspace_uuid: string;
        };
        Update: {
          action?: string;
          actor_user_id?: string | null;
          context?: Json;
          created_at?: string;
          id?: string;
          target_id?: string | null;
          target_type?: string | null;
          workspace_uuid?: string;
        };
        Relationships: [
          {
            foreignKeyName: "agency_audit_log_workspace_uuid_fkey";
            columns: ["workspace_uuid"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["workspace_uuid"];
          },
        ];
      };
      agency_automation_settings: {
        Row: {
          document_expiry_days: number;
          document_expiry_enabled: boolean;
          quote_expiry_days: number;
          quote_expiry_enabled: boolean;
          task_reminder_days: number;
          task_reminders_enabled: boolean;
          updated_at: string;
          updated_by: string | null;
          workspace_uuid: string;
        };
        Insert: {
          document_expiry_days?: number;
          document_expiry_enabled?: boolean;
          quote_expiry_days?: number;
          quote_expiry_enabled?: boolean;
          task_reminder_days?: number;
          task_reminders_enabled?: boolean;
          updated_at?: string;
          updated_by?: string | null;
          workspace_uuid: string;
        };
        Update: {
          document_expiry_days?: number;
          document_expiry_enabled?: boolean;
          quote_expiry_days?: number;
          quote_expiry_enabled?: boolean;
          task_reminder_days?: number;
          task_reminders_enabled?: boolean;
          updated_at?: string;
          updated_by?: string | null;
          workspace_uuid?: string;
        };
        Relationships: [
          {
            foreignKeyName: "agency_automation_settings_workspace_uuid_fkey";
            columns: ["workspace_uuid"];
            isOneToOne: true;
            referencedRelation: "workspaces";
            referencedColumns: ["workspace_uuid"];
          },
        ];
      };
      agency_client_trips: {
        Row: {
          client_id: string;
          linked_at: string;
          linked_by: string | null;
          trip_uuid: string;
        };
        Insert: {
          client_id: string;
          linked_at?: string;
          linked_by?: string | null;
          trip_uuid: string;
        };
        Update: {
          client_id?: string;
          linked_at?: string;
          linked_by?: string | null;
          trip_uuid?: string;
        };
        Relationships: [
          {
            foreignKeyName: "agency_client_trips_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "agency_clients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "agency_client_trips_trip_uuid_fkey";
            columns: ["trip_uuid"];
            isOneToOne: false;
            referencedRelation: "trips";
            referencedColumns: ["trip_uuid"];
          },
        ];
      };
      agency_clients: {
        Row: {
          created_at: string;
          created_by: string | null;
          email: string | null;
          full_name: string;
          id: string;
          locale: string;
          notes: string | null;
          phone: string | null;
          preferences: Json;
          status: string;
          updated_at: string;
          updated_by: string | null;
          workspace_uuid: string;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          email?: string | null;
          full_name: string;
          id?: string;
          locale?: string;
          notes?: string | null;
          phone?: string | null;
          preferences?: Json;
          status?: string;
          updated_at?: string;
          updated_by?: string | null;
          workspace_uuid: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          email?: string | null;
          full_name?: string;
          id?: string;
          locale?: string;
          notes?: string | null;
          phone?: string | null;
          preferences?: Json;
          status?: string;
          updated_at?: string;
          updated_by?: string | null;
          workspace_uuid?: string;
        };
        Relationships: [
          {
            foreignKeyName: "agency_clients_workspace_uuid_fkey";
            columns: ["workspace_uuid"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["workspace_uuid"];
          },
        ];
      };
      agency_domains: {
        Row: {
          custom_domain: string | null;
          subdomain: string | null;
          updated_at: string;
          updated_by: string | null;
          verification_status: string;
          verification_token: string;
          verified_at: string | null;
          workspace_uuid: string;
        };
        Insert: {
          custom_domain?: string | null;
          subdomain?: string | null;
          updated_at?: string;
          updated_by?: string | null;
          verification_status?: string;
          verification_token?: string;
          verified_at?: string | null;
          workspace_uuid: string;
        };
        Update: {
          custom_domain?: string | null;
          subdomain?: string | null;
          updated_at?: string;
          updated_by?: string | null;
          verification_status?: string;
          verification_token?: string;
          verified_at?: string | null;
          workspace_uuid?: string;
        };
        Relationships: [
          {
            foreignKeyName: "agency_domains_workspace_uuid_fkey";
            columns: ["workspace_uuid"];
            isOneToOne: true;
            referencedRelation: "workspaces";
            referencedColumns: ["workspace_uuid"];
          },
        ];
      };
      agency_mail_settings: {
        Row: {
          from_email: string;
          from_name: string;
          reply_to: string | null;
          smtp_secret_ref: string | null;
          updated_at: string;
          updated_by: string | null;
          verification_status: string;
          workspace_uuid: string;
        };
        Insert: {
          from_email: string;
          from_name: string;
          reply_to?: string | null;
          smtp_secret_ref?: string | null;
          updated_at?: string;
          updated_by?: string | null;
          verification_status?: string;
          workspace_uuid: string;
        };
        Update: {
          from_email?: string;
          from_name?: string;
          reply_to?: string | null;
          smtp_secret_ref?: string | null;
          updated_at?: string;
          updated_by?: string | null;
          verification_status?: string;
          workspace_uuid?: string;
        };
        Relationships: [
          {
            foreignKeyName: "agency_mail_settings_workspace_uuid_fkey";
            columns: ["workspace_uuid"];
            isOneToOne: true;
            referencedRelation: "workspaces";
            referencedColumns: ["workspace_uuid"];
          },
        ];
      };
      agency_notification_preferences: {
        Row: {
          client_updates: boolean;
          invitation_responses: boolean;
          trip_changes: boolean;
          updated_at: string;
          user_id: string;
          workspace_uuid: string;
        };
        Insert: {
          client_updates?: boolean;
          invitation_responses?: boolean;
          trip_changes?: boolean;
          updated_at?: string;
          user_id: string;
          workspace_uuid: string;
        };
        Update: {
          client_updates?: boolean;
          invitation_responses?: boolean;
          trip_changes?: boolean;
          updated_at?: string;
          user_id?: string;
          workspace_uuid?: string;
        };
        Relationships: [
          {
            foreignKeyName: "agency_notification_preferences_workspace_uuid_fkey";
            columns: ["workspace_uuid"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["workspace_uuid"];
          },
        ];
      };
      agency_quote_variants: {
        Row: {
          amount: number;
          description: string | null;
          id: string;
          name: string;
          position: number;
          quote_id: string;
        };
        Insert: {
          amount: number;
          description?: string | null;
          id?: string;
          name: string;
          position: number;
          quote_id: string;
        };
        Update: {
          amount?: number;
          description?: string | null;
          id?: string;
          name?: string;
          position?: number;
          quote_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "agency_quote_variants_quote_id_fkey";
            columns: ["quote_id"];
            isOneToOne: false;
            referencedRelation: "agency_quotes";
            referencedColumns: ["id"];
          },
        ];
      };
      agency_quotes: {
        Row: {
          accepted_variant_id: string | null;
          client_id: string;
          converted_at: string | null;
          converted_by: string | null;
          converted_trip_uuid: string | null;
          created_at: string;
          created_by: string | null;
          currency: string;
          id: string;
          introduction: string | null;
          responded_at: string | null;
          response_note: string | null;
          share_expires_at: string | null;
          share_token_hash: string | null;
          shared_at: string | null;
          status: string;
          title: string;
          trip_uuid: string | null;
          updated_at: string;
          updated_by: string | null;
          valid_until: string | null;
          workspace_uuid: string;
        };
        Insert: {
          accepted_variant_id?: string | null;
          client_id: string;
          converted_at?: string | null;
          converted_by?: string | null;
          converted_trip_uuid?: string | null;
          created_at?: string;
          created_by?: string | null;
          currency?: string;
          id?: string;
          introduction?: string | null;
          responded_at?: string | null;
          response_note?: string | null;
          share_expires_at?: string | null;
          share_token_hash?: string | null;
          shared_at?: string | null;
          status?: string;
          title: string;
          trip_uuid?: string | null;
          updated_at?: string;
          updated_by?: string | null;
          valid_until?: string | null;
          workspace_uuid: string;
        };
        Update: {
          accepted_variant_id?: string | null;
          client_id?: string;
          converted_at?: string | null;
          converted_by?: string | null;
          converted_trip_uuid?: string | null;
          created_at?: string;
          created_by?: string | null;
          currency?: string;
          id?: string;
          introduction?: string | null;
          responded_at?: string | null;
          response_note?: string | null;
          share_expires_at?: string | null;
          share_token_hash?: string | null;
          shared_at?: string | null;
          status?: string;
          title?: string;
          trip_uuid?: string | null;
          updated_at?: string;
          updated_by?: string | null;
          valid_until?: string | null;
          workspace_uuid?: string;
        };
        Relationships: [
          {
            foreignKeyName: "agency_quotes_accepted_variant_fk";
            columns: ["accepted_variant_id"];
            isOneToOne: false;
            referencedRelation: "agency_quote_variants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "agency_quotes_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "agency_clients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "agency_quotes_converted_trip_uuid_fkey";
            columns: ["converted_trip_uuid"];
            isOneToOne: false;
            referencedRelation: "trips";
            referencedColumns: ["trip_uuid"];
          },
          {
            foreignKeyName: "agency_quotes_trip_uuid_fkey";
            columns: ["trip_uuid"];
            isOneToOne: false;
            referencedRelation: "trips";
            referencedColumns: ["trip_uuid"];
          },
          {
            foreignKeyName: "agency_quotes_workspace_uuid_fkey";
            columns: ["workspace_uuid"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["workspace_uuid"];
          },
        ];
      };
      agency_role_permissions: {
        Row: {
          permissions: Json;
          role: string;
          updated_at: string;
          updated_by: string | null;
          workspace_uuid: string;
        };
        Insert: {
          permissions: Json;
          role: string;
          updated_at?: string;
          updated_by?: string | null;
          workspace_uuid: string;
        };
        Update: {
          permissions?: Json;
          role?: string;
          updated_at?: string;
          updated_by?: string | null;
          workspace_uuid?: string;
        };
        Relationships: [
          {
            foreignKeyName: "agency_role_permissions_workspace_uuid_fkey";
            columns: ["workspace_uuid"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["workspace_uuid"];
          },
        ];
      };
      agency_settings: {
        Row: {
          accent: number;
          contact_email: string;
          currency: string;
          default_locale: string;
          domain: string;
          logo_path: string | null;
          sender_name: string;
          system_name: string;
          tagline: string;
          timezone: string;
          updated_at: string;
          updated_by: string | null;
          workspace_uuid: string;
        };
        Insert: {
          accent?: number;
          contact_email: string;
          currency?: string;
          default_locale?: string;
          domain?: string;
          logo_path?: string | null;
          sender_name?: string;
          system_name?: string;
          tagline?: string;
          timezone?: string;
          updated_at?: string;
          updated_by?: string | null;
          workspace_uuid: string;
        };
        Update: {
          accent?: number;
          contact_email?: string;
          currency?: string;
          default_locale?: string;
          domain?: string;
          logo_path?: string | null;
          sender_name?: string;
          system_name?: string;
          tagline?: string;
          timezone?: string;
          updated_at?: string;
          updated_by?: string | null;
          workspace_uuid?: string;
        };
        Relationships: [
          {
            foreignKeyName: "agency_settings_workspace_uuid_fkey";
            columns: ["workspace_uuid"];
            isOneToOne: true;
            referencedRelation: "workspaces";
            referencedColumns: ["workspace_uuid"];
          },
        ];
      };
      agency_supplier_trips: {
        Row: {
          linked_at: string;
          linked_by: string | null;
          supplier_id: string;
          trip_uuid: string;
        };
        Insert: {
          linked_at?: string;
          linked_by?: string | null;
          supplier_id: string;
          trip_uuid: string;
        };
        Update: {
          linked_at?: string;
          linked_by?: string | null;
          supplier_id?: string;
          trip_uuid?: string;
        };
        Relationships: [
          {
            foreignKeyName: "agency_supplier_trips_supplier_id_fkey";
            columns: ["supplier_id"];
            isOneToOne: false;
            referencedRelation: "agency_suppliers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "agency_supplier_trips_trip_uuid_fkey";
            columns: ["trip_uuid"];
            isOneToOne: false;
            referencedRelation: "trips";
            referencedColumns: ["trip_uuid"];
          },
        ];
      };
      agency_suppliers: {
        Row: {
          booking_terms: string | null;
          commission_percent: number | null;
          contact_name: string | null;
          created_at: string;
          created_by: string | null;
          email: string | null;
          id: string;
          name: string;
          notes: string | null;
          phone: string | null;
          status: string;
          supplier_type: string;
          updated_at: string;
          updated_by: string | null;
          website: string | null;
          workspace_uuid: string;
        };
        Insert: {
          booking_terms?: string | null;
          commission_percent?: number | null;
          contact_name?: string | null;
          created_at?: string;
          created_by?: string | null;
          email?: string | null;
          id?: string;
          name: string;
          notes?: string | null;
          phone?: string | null;
          status?: string;
          supplier_type: string;
          updated_at?: string;
          updated_by?: string | null;
          website?: string | null;
          workspace_uuid: string;
        };
        Update: {
          booking_terms?: string | null;
          commission_percent?: number | null;
          contact_name?: string | null;
          created_at?: string;
          created_by?: string | null;
          email?: string | null;
          id?: string;
          name?: string;
          notes?: string | null;
          phone?: string | null;
          status?: string;
          supplier_type?: string;
          updated_at?: string;
          updated_by?: string | null;
          website?: string | null;
          workspace_uuid?: string;
        };
        Relationships: [
          {
            foreignKeyName: "agency_suppliers_workspace_uuid_fkey";
            columns: ["workspace_uuid"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["workspace_uuid"];
          },
        ];
      };
      agency_tasks: {
        Row: {
          assignee_user_id: string | null;
          client_id: string | null;
          created_at: string;
          created_by: string | null;
          due_date: string | null;
          id: string;
          notes: string | null;
          priority: string;
          status: string;
          title: string;
          trip_uuid: string | null;
          updated_at: string;
          updated_by: string | null;
          workspace_uuid: string;
        };
        Insert: {
          assignee_user_id?: string | null;
          client_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          due_date?: string | null;
          id?: string;
          notes?: string | null;
          priority?: string;
          status?: string;
          title: string;
          trip_uuid?: string | null;
          updated_at?: string;
          updated_by?: string | null;
          workspace_uuid: string;
        };
        Update: {
          assignee_user_id?: string | null;
          client_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          due_date?: string | null;
          id?: string;
          notes?: string | null;
          priority?: string;
          status?: string;
          title?: string;
          trip_uuid?: string | null;
          updated_at?: string;
          updated_by?: string | null;
          workspace_uuid?: string;
        };
        Relationships: [
          {
            foreignKeyName: "agency_tasks_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "agency_clients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "agency_tasks_trip_uuid_fkey";
            columns: ["trip_uuid"];
            isOneToOne: false;
            referencedRelation: "trips";
            referencedColumns: ["trip_uuid"];
          },
          {
            foreignKeyName: "agency_tasks_workspace_uuid_fkey";
            columns: ["workspace_uuid"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["workspace_uuid"];
          },
        ];
      };
      agency_templates: {
        Row: {
          archived_at: string | null;
          content: Json;
          created_at: string;
          created_by: string | null;
          id: string;
          name: string;
          template_type: string;
          updated_at: string;
          updated_by: string | null;
          workspace_uuid: string;
        };
        Insert: {
          archived_at?: string | null;
          content: Json;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          name: string;
          template_type: string;
          updated_at?: string;
          updated_by?: string | null;
          workspace_uuid: string;
        };
        Update: {
          archived_at?: string | null;
          content?: Json;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          name?: string;
          template_type?: string;
          updated_at?: string;
          updated_by?: string | null;
          workspace_uuid?: string;
        };
        Relationships: [
          {
            foreignKeyName: "agency_templates_workspace_uuid_fkey";
            columns: ["workspace_uuid"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["workspace_uuid"];
          },
        ];
      };
      beta_feedback: {
        Row: {
          archived_at: string | null;
          browser_info: string | null;
          category: string;
          created_at: string;
          description: string;
          id: string;
          page_url: string | null;
          status: string;
          title: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          archived_at?: string | null;
          browser_info?: string | null;
          category?: string;
          created_at?: string;
          description: string;
          id?: string;
          page_url?: string | null;
          status?: string;
          title: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          archived_at?: string | null;
          browser_info?: string | null;
          category?: string;
          created_at?: string;
          description?: string;
          id?: string;
          page_url?: string | null;
          status?: string;
          title?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      billing_customers: {
        Row: {
          billing_email: string | null;
          country_code: string | null;
          created_at: string;
          id: string;
          provider: string;
          provider_customer_id: string;
          updated_at: string;
          workspace_uuid: string;
        };
        Insert: {
          billing_email?: string | null;
          country_code?: string | null;
          created_at?: string;
          id?: string;
          provider?: string;
          provider_customer_id: string;
          updated_at?: string;
          workspace_uuid: string;
        };
        Update: {
          billing_email?: string | null;
          country_code?: string | null;
          created_at?: string;
          id?: string;
          provider?: string;
          provider_customer_id?: string;
          updated_at?: string;
          workspace_uuid?: string;
        };
        Relationships: [
          {
            foreignKeyName: "billing_customers_workspace_uuid_fkey";
            columns: ["workspace_uuid"];
            isOneToOne: true;
            referencedRelation: "workspaces";
            referencedColumns: ["workspace_uuid"];
          },
        ];
      };
      billing_entitlements: {
        Row: {
          created_at: string;
          ends_at: string;
          id: string;
          plan: string;
          provider_transaction_id: string;
          starts_at: string;
          workspace_uuid: string;
        };
        Insert: {
          created_at?: string;
          ends_at: string;
          id?: string;
          plan: string;
          provider_transaction_id: string;
          starts_at?: string;
          workspace_uuid: string;
        };
        Update: {
          created_at?: string;
          ends_at?: string;
          id?: string;
          plan?: string;
          provider_transaction_id?: string;
          starts_at?: string;
          workspace_uuid?: string;
        };
        Relationships: [
          {
            foreignKeyName: "billing_entitlements_workspace_uuid_fkey";
            columns: ["workspace_uuid"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["workspace_uuid"];
          },
        ];
      };
      billing_subscriptions: {
        Row: {
          billing_interval: string;
          cancelled_at: string | null;
          created_at: string;
          currency: string;
          current_period_end: string | null;
          current_period_start: string | null;
          customer_id: string;
          id: string;
          plan: string;
          provider_subscription_id: string;
          recurring_total_minor: number;
          scheduled_change: string | null;
          status: string;
          updated_at: string;
        };
        Insert: {
          billing_interval: string;
          cancelled_at?: string | null;
          created_at?: string;
          currency: string;
          current_period_end?: string | null;
          current_period_start?: string | null;
          customer_id: string;
          id?: string;
          plan: string;
          provider_subscription_id: string;
          recurring_total_minor: number;
          scheduled_change?: string | null;
          status: string;
          updated_at?: string;
        };
        Update: {
          billing_interval?: string;
          cancelled_at?: string | null;
          created_at?: string;
          currency?: string;
          current_period_end?: string | null;
          current_period_start?: string | null;
          customer_id?: string;
          id?: string;
          plan?: string;
          provider_subscription_id?: string;
          recurring_total_minor?: number;
          scheduled_change?: string | null;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "billing_subscriptions_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "billing_customers";
            referencedColumns: ["id"];
          },
        ];
      };
      billing_transactions: {
        Row: {
          created_at: string;
          currency: string;
          customer_id: string;
          id: string;
          invoice_id: string | null;
          occurred_at: string;
          provider_transaction_id: string;
          refunded_minor: number;
          status: string;
          subscription_id: string | null;
          subtotal_minor: number;
          tax_minor: number;
          total_minor: number;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          currency: string;
          customer_id: string;
          id?: string;
          invoice_id?: string | null;
          occurred_at: string;
          provider_transaction_id: string;
          refunded_minor?: number;
          status: string;
          subscription_id?: string | null;
          subtotal_minor: number;
          tax_minor: number;
          total_minor: number;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          currency?: string;
          customer_id?: string;
          id?: string;
          invoice_id?: string | null;
          occurred_at?: string;
          provider_transaction_id?: string;
          refunded_minor?: number;
          status?: string;
          subscription_id?: string | null;
          subtotal_minor?: number;
          tax_minor?: number;
          total_minor?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "billing_transactions_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "billing_customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "billing_transactions_invoice_id_fkey";
            columns: ["invoice_id"];
            isOneToOne: false;
            referencedRelation: "corporate_invoices";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "billing_transactions_subscription_id_fkey";
            columns: ["subscription_id"];
            isOneToOne: false;
            referencedRelation: "billing_subscriptions";
            referencedColumns: ["id"];
          },
        ];
      };
      billing_webhook_events: {
        Row: {
          attempts: number;
          event_type: string;
          id: string;
          last_error_code: string | null;
          notification_id: string | null;
          occurred_at: string;
          payload: Json;
          processed_at: string | null;
          provider: string;
          provider_event_id: string;
          received_at: string;
          status: string;
        };
        Insert: {
          attempts?: number;
          event_type: string;
          id?: string;
          last_error_code?: string | null;
          notification_id?: string | null;
          occurred_at: string;
          payload: Json;
          processed_at?: string | null;
          provider?: string;
          provider_event_id: string;
          received_at?: string;
          status?: string;
        };
        Update: {
          attempts?: number;
          event_type?: string;
          id?: string;
          last_error_code?: string | null;
          notification_id?: string | null;
          occurred_at?: string;
          payload?: Json;
          processed_at?: string | null;
          provider?: string;
          provider_event_id?: string;
          received_at?: string;
          status?: string;
        };
        Relationships: [];
      };
      contact_messages: {
        Row: {
          category: string;
          created_at: string;
          email: string;
          handled_by: string | null;
          id: string;
          locale: string;
          message: string;
          name: string;
          status: string;
          subject: string;
          updated_at: string;
        };
        Insert: {
          category?: string;
          created_at?: string;
          email: string;
          handled_by?: string | null;
          id?: string;
          locale?: string;
          message: string;
          name: string;
          status?: string;
          subject: string;
          updated_at?: string;
        };
        Update: {
          category?: string;
          created_at?: string;
          email?: string;
          handled_by?: string | null;
          id?: string;
          locale?: string;
          message?: string;
          name?: string;
          status?: string;
          subject?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      corporate_invoices: {
        Row: {
          created_at: string;
          currency: string;
          customer_email: string | null;
          customer_name: string;
          due_at: string | null;
          external_id: string | null;
          external_provider: string;
          hosted_url: string | null;
          id: string;
          invoice_number: string;
          issued_at: string | null;
          paid_at: string | null;
          status: string;
          subtotal_minor: number;
          tax_minor: number;
          total_minor: number;
          updated_at: string;
          workspace_uuid: string | null;
        };
        Insert: {
          created_at?: string;
          currency: string;
          customer_email?: string | null;
          customer_name: string;
          due_at?: string | null;
          external_id?: string | null;
          external_provider?: string;
          hosted_url?: string | null;
          id?: string;
          invoice_number: string;
          issued_at?: string | null;
          paid_at?: string | null;
          status: string;
          subtotal_minor: number;
          tax_minor?: number;
          total_minor: number;
          updated_at?: string;
          workspace_uuid?: string | null;
        };
        Update: {
          created_at?: string;
          currency?: string;
          customer_email?: string | null;
          customer_name?: string;
          due_at?: string | null;
          external_id?: string | null;
          external_provider?: string;
          hosted_url?: string | null;
          id?: string;
          invoice_number?: string;
          issued_at?: string | null;
          paid_at?: string | null;
          status?: string;
          subtotal_minor?: number;
          tax_minor?: number;
          total_minor?: number;
          updated_at?: string;
          workspace_uuid?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "corporate_invoices_workspace_uuid_fkey";
            columns: ["workspace_uuid"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["workspace_uuid"];
          },
        ];
      };
      corporate_mail_attachments: {
        Row: {
          content_type: string;
          created_at: string;
          file_name: string;
          id: string;
          message_id: string | null;
          send_queue_id: string | null;
          sha256: string;
          size_bytes: number;
          storage_key: string;
        };
        Insert: {
          content_type: string;
          created_at?: string;
          file_name: string;
          id?: string;
          message_id?: string | null;
          send_queue_id?: string | null;
          sha256: string;
          size_bytes: number;
          storage_key: string;
        };
        Update: {
          content_type?: string;
          created_at?: string;
          file_name?: string;
          id?: string;
          message_id?: string | null;
          send_queue_id?: string | null;
          sha256?: string;
          size_bytes?: number;
          storage_key?: string;
        };
        Relationships: [
          {
            foreignKeyName: "corporate_mail_attachments_message_id_fkey";
            columns: ["message_id"];
            isOneToOne: false;
            referencedRelation: "corporate_mail_messages";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "corporate_mail_attachments_send_queue_id_fkey";
            columns: ["send_queue_id"];
            isOneToOne: false;
            referencedRelation: "corporate_mail_send_queue";
            referencedColumns: ["id"];
          },
        ];
      };
      corporate_mail_uploads: {
        Row: {
          content_type: string;
          created_at: string;
          created_by: string;
          expires_at: string;
          file_name: string;
          id: string;
          mailbox_id: string;
          sha256: string;
          size_bytes: number;
          storage_key: string;
        };
        Insert: {
          content_type: string;
          created_at?: string;
          created_by: string;
          expires_at?: string;
          file_name: string;
          id?: string;
          mailbox_id: string;
          sha256: string;
          size_bytes: number;
          storage_key: string;
        };
        Update: {
          content_type?: string;
          created_at?: string;
          created_by?: string;
          expires_at?: string;
          file_name?: string;
          id?: string;
          mailbox_id?: string;
          sha256?: string;
          size_bytes?: number;
          storage_key?: string;
        };
        Relationships: [
          {
            foreignKeyName: "corporate_mail_uploads_mailbox_id_fkey";
            columns: ["mailbox_id"];
            isOneToOne: false;
            referencedRelation: "corporate_mailboxes";
            referencedColumns: ["id"];
          },
        ];
      };
      corporate_mail_messages: {
        Row: {
          archived_at: string | null;
          body_storage_key: string | null;
          body_text: string | null;
          created_at: string;
          direction: string;
          id: string;
          mailbox_id: string;
          preview_text: string;
          provider_message_id: string;
          read_at: string | null;
          received_at: string;
          recipient_addresses: string[];
          sender_address: string;
          subject: string;
          thread_key: string | null;
        };
        Insert: {
          archived_at?: string | null;
          body_storage_key?: string | null;
          body_text?: string | null;
          created_at?: string;
          direction: string;
          id?: string;
          mailbox_id: string;
          preview_text?: string;
          provider_message_id: string;
          read_at?: string | null;
          received_at: string;
          recipient_addresses?: string[];
          sender_address: string;
          subject?: string;
          thread_key?: string | null;
        };
        Update: {
          archived_at?: string | null;
          body_storage_key?: string | null;
          body_text?: string | null;
          created_at?: string;
          direction?: string;
          id?: string;
          mailbox_id?: string;
          preview_text?: string;
          provider_message_id?: string;
          read_at?: string | null;
          received_at?: string;
          recipient_addresses?: string[];
          sender_address?: string;
          subject?: string;
          thread_key?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "corporate_mail_messages_mailbox_id_fkey";
            columns: ["mailbox_id"];
            isOneToOne: false;
            referencedRelation: "corporate_mailboxes";
            referencedColumns: ["id"];
          },
        ];
      };
      corporate_mail_drafts: {
        Row: {
          body_html: string;
          body_text: string;
          cc_addresses: string[];
          created_at: string;
          created_by: string;
          id: string;
          in_reply_to_message_id: string | null;
          mailbox_id: string;
          recipient_addresses: string[];
          subject: string;
          updated_at: string;
        };
        Insert: {
          body_html?: string;
          body_text?: string;
          cc_addresses?: string[];
          created_at?: string;
          created_by: string;
          id?: string;
          in_reply_to_message_id?: string | null;
          mailbox_id: string;
          recipient_addresses?: string[];
          subject?: string;
          updated_at?: string;
        };
        Update: {
          body_html?: string;
          body_text?: string;
          cc_addresses?: string[];
          created_at?: string;
          created_by?: string;
          id?: string;
          in_reply_to_message_id?: string | null;
          mailbox_id?: string;
          recipient_addresses?: string[];
          subject?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "corporate_mail_drafts_in_reply_to_message_id_fkey";
            columns: ["in_reply_to_message_id"];
            isOneToOne: false;
            referencedRelation: "corporate_mail_messages";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "corporate_mail_drafts_mailbox_id_fkey";
            columns: ["mailbox_id"];
            isOneToOne: false;
            referencedRelation: "corporate_mailboxes";
            referencedColumns: ["id"];
          },
        ];
      };
      corporate_mail_send_queue: {
        Row: {
          attempts: number;
          available_at: string;
          body_html: string | null;
          body_text: string;
          cc_addresses: string[];
          claimed_at: string | null;
          created_at: string;
          created_by: string;
          id: string;
          in_reply_to_message_id: string | null;
          last_error_code: string | null;
          mailbox_id: string;
          recipient_addresses: string[];
          sent_at: string | null;
          status: string;
          subject: string;
          updated_at: string;
        };
        Insert: {
          attempts?: number;
          available_at?: string;
          body_html?: string | null;
          body_text: string;
          cc_addresses?: string[];
          claimed_at?: string | null;
          created_at?: string;
          created_by: string;
          id?: string;
          in_reply_to_message_id?: string | null;
          last_error_code?: string | null;
          mailbox_id: string;
          recipient_addresses: string[];
          sent_at?: string | null;
          status?: string;
          subject: string;
          updated_at?: string;
        };
        Update: {
          attempts?: number;
          available_at?: string;
          body_html?: string | null;
          body_text?: string;
          cc_addresses?: string[];
          claimed_at?: string | null;
          created_at?: string;
          created_by?: string;
          id?: string;
          in_reply_to_message_id?: string | null;
          last_error_code?: string | null;
          mailbox_id?: string;
          recipient_addresses?: string[];
          sent_at?: string | null;
          status?: string;
          subject?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "corporate_mail_send_queue_in_reply_to_message_id_fkey";
            columns: ["in_reply_to_message_id"];
            isOneToOne: false;
            referencedRelation: "corporate_mail_messages";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "corporate_mail_send_queue_mailbox_id_fkey";
            columns: ["mailbox_id"];
            isOneToOne: false;
            referencedRelation: "corporate_mailboxes";
            referencedColumns: ["id"];
          },
        ];
      };
      corporate_mailbox_members: {
        Row: {
          created_at: string;
          mailbox_id: string;
          permission: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          mailbox_id: string;
          permission: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          mailbox_id?: string;
          permission?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "corporate_mailbox_members_mailbox_id_fkey";
            columns: ["mailbox_id"];
            isOneToOne: false;
            referencedRelation: "corporate_mailboxes";
            referencedColumns: ["id"];
          },
        ];
      };
      corporate_mailboxes: {
        Row: {
          active: boolean;
          address: string;
          created_at: string;
          credentials_updated_at: string | null;
          display_name: string;
          id: string;
          imap_host: string | null;
          imap_password_ciphertext: string | null;
          imap_port: number;
          imap_secure: boolean;
          imap_username: string | null;
          inbound_secret_ref: string | null;
          last_synced_at: string | null;
          mailbox_type: string;
          outbound_secret_ref: string | null;
          owner_user_id: string | null;
          signature_text: string | null;
          sync_status: string;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          address: string;
          created_at?: string;
          credentials_updated_at?: string | null;
          display_name: string;
          id?: string;
          imap_host?: string | null;
          imap_password_ciphertext?: string | null;
          imap_port?: number;
          imap_secure?: boolean;
          imap_username?: string | null;
          inbound_secret_ref?: string | null;
          last_synced_at?: string | null;
          mailbox_type: string;
          outbound_secret_ref?: string | null;
          owner_user_id?: string | null;
          signature_text?: string | null;
          sync_status?: string;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          address?: string;
          created_at?: string;
          credentials_updated_at?: string | null;
          display_name?: string;
          id?: string;
          imap_host?: string | null;
          imap_password_ciphertext?: string | null;
          imap_port?: number;
          imap_secure?: boolean;
          imap_username?: string | null;
          inbound_secret_ref?: string | null;
          last_synced_at?: string | null;
          mailbox_type?: string;
          outbound_secret_ref?: string | null;
          owner_user_id?: string | null;
          signature_text?: string | null;
          sync_status?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      email_delivery_config: {
        Row: {
          id: boolean;
          mode: string;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          id?: boolean;
          mode?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          id?: boolean;
          mode?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [];
      };
      email_outbox: {
        Row: {
          attempts: number;
          available_at: string;
          claimed_at: string | null;
          created_at: string;
          id: string;
          invitation_action_url: string | null;
          invitation_id: string | null;
          invitation_type: string | null;
          last_error_code: string | null;
          locale: string;
          notification_id: string | null;
          payload: Json;
          recipient_email: string;
          sent_at: string | null;
          status: string;
          template_key: string;
          updated_at: string;
          user_id: string | null;
        };
        Insert: {
          attempts?: number;
          available_at?: string;
          claimed_at?: string | null;
          created_at?: string;
          id?: string;
          invitation_action_url?: string | null;
          invitation_id?: string | null;
          invitation_type?: string | null;
          last_error_code?: string | null;
          locale: string;
          notification_id?: string | null;
          payload: Json;
          recipient_email: string;
          sent_at?: string | null;
          status?: string;
          template_key: string;
          updated_at?: string;
          user_id?: string | null;
        };
        Update: {
          attempts?: number;
          available_at?: string;
          claimed_at?: string | null;
          created_at?: string;
          id?: string;
          invitation_action_url?: string | null;
          invitation_id?: string | null;
          invitation_type?: string | null;
          last_error_code?: string | null;
          locale?: string;
          notification_id?: string | null;
          payload?: Json;
          recipient_email?: string;
          sent_at?: string | null;
          status?: string;
          template_key?: string;
          updated_at?: string;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "email_outbox_notification_id_fkey";
            columns: ["notification_id"];
            isOneToOne: true;
            referencedRelation: "notifications";
            referencedColumns: ["id"];
          },
        ];
      };
      external_api_usage: {
        Row: {
          actor_user_id: string;
          calls: number;
          provider: string;
          updated_at: string;
          usage_date: string;
          workspace_uuid: string;
        };
        Insert: {
          actor_user_id: string;
          calls?: number;
          provider: string;
          updated_at?: string;
          usage_date?: string;
          workspace_uuid: string;
        };
        Update: {
          actor_user_id?: string;
          calls?: number;
          provider?: string;
          updated_at?: string;
          usage_date?: string;
          workspace_uuid?: string;
        };
        Relationships: [
          {
            foreignKeyName: "external_api_usage_provider_fkey";
            columns: ["provider"];
            isOneToOne: false;
            referencedRelation: "platform_provider_controls";
            referencedColumns: ["provider"];
          },
          {
            foreignKeyName: "external_api_usage_workspace_uuid_fkey";
            columns: ["workspace_uuid"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["workspace_uuid"];
          },
        ];
      };
      feedback_replies: {
        Row: {
          author_user_id: string | null;
          body: string;
          created_at: string;
          feedback_id: string;
          id: string;
        };
        Insert: {
          author_user_id?: string | null;
          body: string;
          created_at?: string;
          feedback_id: string;
          id?: string;
        };
        Update: {
          author_user_id?: string | null;
          body?: string;
          created_at?: string;
          feedback_id?: string;
          id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "feedback_replies_feedback_id_fkey";
            columns: ["feedback_id"];
            isOneToOne: false;
            referencedRelation: "beta_feedback";
            referencedColumns: ["id"];
          },
        ];
      };
      flight_lookup_usage: {
        Row: {
          lookup_count: number;
          user_id: string;
          window_start: string;
        };
        Insert: {
          lookup_count?: number;
          user_id: string;
          window_start: string;
        };
        Update: {
          lookup_count?: number;
          user_id?: string;
          window_start?: string;
        };
        Relationships: [];
      };
      infrastructure_servers: {
        Row: {
          active: boolean;
          cpu_count: number | null;
          created_at: string;
          host_key_fingerprint: string | null;
          id: string;
          ipv4: unknown;
          ipv6_cidr: unknown;
          memory_mb: number | null;
          name: string;
          notes: string | null;
          server_role: string;
          ssh_port: number;
          ssh_public_key: string | null;
          ssh_user: string | null;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          active?: boolean;
          cpu_count?: number | null;
          created_at?: string;
          host_key_fingerprint?: string | null;
          id?: string;
          ipv4?: unknown;
          ipv6_cidr?: unknown;
          memory_mb?: number | null;
          name: string;
          notes?: string | null;
          server_role: string;
          ssh_port?: number;
          ssh_public_key?: string | null;
          ssh_user?: string | null;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          active?: boolean;
          cpu_count?: number | null;
          created_at?: string;
          host_key_fingerprint?: string | null;
          id?: string;
          ipv4?: unknown;
          ipv6_cidr?: unknown;
          memory_mb?: number | null;
          name?: string;
          notes?: string | null;
          server_role?: string;
          ssh_port?: number;
          ssh_public_key?: string | null;
          ssh_user?: string | null;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [];
      };
      known_issues: {
        Row: {
          archived_at: string | null;
          category: string;
          created_at: string;
          description_en: string;
          description_nl: string;
          github_issue_number: number | null;
          id: string;
          public: boolean;
          severity: string;
          status: string;
          title_en: string;
          title_nl: string;
          updated_at: string;
        };
        Insert: {
          archived_at?: string | null;
          category?: string;
          created_at?: string;
          description_en: string;
          description_nl: string;
          github_issue_number?: number | null;
          id?: string;
          public?: boolean;
          severity?: string;
          status?: string;
          title_en: string;
          title_nl: string;
          updated_at?: string;
        };
        Update: {
          archived_at?: string | null;
          category?: string;
          created_at?: string;
          description_en?: string;
          description_nl?: string;
          github_issue_number?: number | null;
          id?: string;
          public?: boolean;
          severity?: string;
          status?: string;
          title_en?: string;
          title_nl?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      notifications: {
        Row: {
          body: string;
          created_at: string;
          dismissed_at: string | null;
          event_key: string;
          id: string;
          kind: string;
          title: string;
          trip_uuid: string | null;
          user_id: string;
        };
        Insert: {
          body: string;
          created_at?: string;
          dismissed_at?: string | null;
          event_key: string;
          id?: string;
          kind: string;
          title: string;
          trip_uuid?: string | null;
          user_id: string;
        };
        Update: {
          body?: string;
          created_at?: string;
          dismissed_at?: string | null;
          event_key?: string;
          id?: string;
          kind?: string;
          title?: string;
          trip_uuid?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "notifications_trip_uuid_fkey";
            columns: ["trip_uuid"];
            isOneToOne: false;
            referencedRelation: "trips";
            referencedColumns: ["trip_uuid"];
          },
        ];
      };
      platform_admin_audit_log: {
        Row: {
          action: string;
          actor_user_id: string | null;
          created_at: string;
          details: Json;
          id: string;
          result: string;
          target_id: string | null;
          target_type: string | null;
        };
        Insert: {
          action: string;
          actor_user_id?: string | null;
          created_at?: string;
          details?: Json;
          id?: string;
          result: string;
          target_id?: string | null;
          target_type?: string | null;
        };
        Update: {
          action?: string;
          actor_user_id?: string | null;
          created_at?: string;
          details?: Json;
          id?: string;
          result?: string;
          target_id?: string | null;
          target_type?: string | null;
        };
        Relationships: [];
      };
      platform_admins: {
        Row: {
          active: boolean;
          created_at: string;
          created_by: string | null;
          deactivated_at: string | null;
          job_title: string | null;
          permissions: Json;
          role: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          active?: boolean;
          created_at?: string;
          created_by?: string | null;
          deactivated_at?: string | null;
          job_title?: string | null;
          permissions?: Json;
          role?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          active?: boolean;
          created_at?: string;
          created_by?: string | null;
          deactivated_at?: string | null;
          job_title?: string | null;
          permissions?: Json;
          role?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      platform_announcements: {
        Row: {
          announcement_type: string;
          body_en: string;
          body_nl: string;
          created_at: string;
          created_by: string;
          id: string;
          published_at: string | null;
          severity: string;
          status_key: string | null;
          title_en: string;
          title_nl: string;
        };
        Insert: {
          announcement_type: string;
          body_en: string;
          body_nl: string;
          created_at?: string;
          created_by: string;
          id?: string;
          published_at?: string | null;
          severity?: string;
          status_key?: string | null;
          title_en: string;
          title_nl: string;
        };
        Update: {
          announcement_type?: string;
          body_en?: string;
          body_nl?: string;
          created_at?: string;
          created_by?: string;
          id?: string;
          published_at?: string | null;
          severity?: string;
          status_key?: string | null;
          title_en?: string;
          title_nl?: string;
        };
        Relationships: [];
      };
      platform_feature_flags: {
        Row: {
          audience: string;
          enabled: boolean;
          flag_key: string;
          label_en: string;
          label_nl: string;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          audience?: string;
          enabled?: boolean;
          flag_key: string;
          label_en: string;
          label_nl: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          audience?: string;
          enabled?: boolean;
          flag_key?: string;
          label_en?: string;
          label_nl?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [];
      };
      platform_incidents: {
        Row: {
          id: string;
          resolved_at: string | null;
          severity: string;
          started_at: string;
          status: string;
          summary: string;
          title: string;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          id?: string;
          resolved_at?: string | null;
          severity: string;
          started_at?: string;
          status?: string;
          summary: string;
          title: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          id?: string;
          resolved_at?: string | null;
          severity?: string;
          started_at?: string;
          status?: string;
          summary?: string;
          title?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [];
      };
      platform_maintenance: {
        Row: {
          active: boolean;
          ends_at: string | null;
          progress_percent: number;
          reason_en: string;
          reason_nl: string;
          singleton: boolean;
          starts_at: string | null;
          status_en: string;
          status_nl: string;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          active?: boolean;
          ends_at?: string | null;
          progress_percent?: number;
          reason_en?: string;
          reason_nl?: string;
          singleton?: boolean;
          starts_at?: string | null;
          status_en?: string;
          status_nl?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          active?: boolean;
          ends_at?: string | null;
          progress_percent?: number;
          reason_en?: string;
          reason_nl?: string;
          singleton?: boolean;
          starts_at?: string | null;
          status_en?: string;
          status_nl?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [];
      };
      platform_provider_controls: {
        Row: {
          enabled: boolean;
          provider: string;
          reason: string | null;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          enabled?: boolean;
          provider: string;
          reason?: string | null;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          enabled?: boolean;
          provider?: string;
          reason?: string | null;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [];
      };
      platform_status_components: {
        Row: {
          checked_at: string | null;
          component_key: string;
          name_en: string;
          name_nl: string;
          response_ms: number | null;
          status: string;
          updated_at: string;
        };
        Insert: {
          checked_at?: string | null;
          component_key: string;
          name_en: string;
          name_nl: string;
          response_ms?: number | null;
          status?: string;
          updated_at?: string;
        };
        Update: {
          checked_at?: string | null;
          component_key?: string;
          name_en?: string;
          name_nl?: string;
          response_ms?: number | null;
          status?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      privacy_requests: {
        Row: {
          closed_at: string | null;
          due_at: string;
          id: string;
          notes: string | null;
          received_at: string;
          request_type: string;
          requester_email: string;
          responded_at: string | null;
          response_text: string | null;
          status: string;
          updated_at: string;
          updated_by: string | null;
          user_id: string | null;
        };
        Insert: {
          closed_at?: string | null;
          due_at?: string;
          id?: string;
          notes?: string | null;
          received_at?: string;
          request_type: string;
          requester_email: string;
          responded_at?: string | null;
          response_text?: string | null;
          status?: string;
          updated_at?: string;
          updated_by?: string | null;
          user_id?: string | null;
        };
        Update: {
          closed_at?: string | null;
          due_at?: string;
          id?: string;
          notes?: string | null;
          received_at?: string;
          request_type?: string;
          requester_email?: string;
          responded_at?: string | null;
          response_text?: string | null;
          status?: string;
          updated_at?: string;
          updated_by?: string | null;
          user_id?: string | null;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          avatar_path: string | null;
          onboarding_completed_at: string | null;
          created_at: string;
          display_name: string | null;
          email: string | null;
          id: string;
          locale: string;
          notification_preferences: Json;
          phone: string | null;
          theme: string;
          timezone: string;
          updated_at: string;
        };
        Insert: {
          avatar_path?: string | null;
          onboarding_completed_at?: string | null;
          created_at?: string;
          display_name?: string | null;
          email?: string | null;
          id: string;
          locale?: string;
          notification_preferences?: Json;
          phone?: string | null;
          theme?: string;
          timezone?: string;
          updated_at?: string;
        };
        Update: {
          avatar_path?: string | null;
          onboarding_completed_at?: string | null;
          created_at?: string;
          display_name?: string | null;
          email?: string | null;
          id?: string;
          locale?: string;
          notification_preferences?: Json;
          phone?: string | null;
          theme?: string;
          timezone?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      release_checklist_items: {
        Row: {
          category: string;
          completed_at: string | null;
          completed_by: string | null;
          item_key: string;
          label_en: string;
          label_nl: string;
          notes: string | null;
          position: number;
          updated_at: string;
        };
        Insert: {
          category: string;
          completed_at?: string | null;
          completed_by?: string | null;
          item_key: string;
          label_en: string;
          label_nl: string;
          notes?: string | null;
          position: number;
          updated_at?: string;
        };
        Update: {
          category?: string;
          completed_at?: string | null;
          completed_by?: string | null;
          item_key?: string;
          label_en?: string;
          label_nl?: string;
          notes?: string | null;
          position?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      staff_security_settings: {
        Row: { id: boolean; enforced: boolean };
        Insert: { id?: boolean; enforced?: boolean };
        Update: { id?: boolean; enforced?: boolean };
        Relationships: [];
      };
      testimonials: {
        Row: {
          archived_at: string | null;
          author_context_en: string | null;
          author_context_nl: string | null;
          author_name: string;
          created_at: string;
          id: string;
          position: number;
          published: boolean;
          quote_en: string | null;
          quote_nl: string;
          rating: number | null;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          archived_at?: string | null;
          author_context_en?: string | null;
          author_context_nl?: string | null;
          author_name: string;
          created_at?: string;
          id?: string;
          position?: number;
          published?: boolean;
          quote_en?: string | null;
          quote_nl: string;
          rating?: number | null;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          archived_at?: string | null;
          author_context_en?: string | null;
          author_context_nl?: string | null;
          author_name?: string;
          created_at?: string;
          id?: string;
          position?: number;
          published?: boolean;
          quote_en?: string | null;
          quote_nl?: string;
          rating?: number | null;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [];
      };
      trip_branding_overrides: {
        Row: {
          accent: number | null;
          brand_name: string | null;
          domain: string | null;
          enabled: boolean;
          tagline: string | null;
          trip_uuid: string;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          accent?: number | null;
          brand_name?: string | null;
          domain?: string | null;
          enabled?: boolean;
          tagline?: string | null;
          trip_uuid: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          accent?: number | null;
          brand_name?: string | null;
          domain?: string | null;
          enabled?: boolean;
          tagline?: string | null;
          trip_uuid?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "trip_branding_overrides_trip_uuid_fkey";
            columns: ["trip_uuid"];
            isOneToOne: true;
            referencedRelation: "trips";
            referencedColumns: ["trip_uuid"];
          },
        ];
      };
      trip_calendar_feeds: {
        Row: {
          active: boolean;
          created_at: string;
          created_by: string;
          id: string;
          revoked_at: string | null;
          token_hash: string;
          trip_uuid: string;
        };
        Insert: {
          active?: boolean;
          created_at?: string;
          created_by: string;
          id?: string;
          revoked_at?: string | null;
          token_hash: string;
          trip_uuid: string;
        };
        Update: {
          active?: boolean;
          created_at?: string;
          created_by?: string;
          id?: string;
          revoked_at?: string | null;
          token_hash?: string;
          trip_uuid?: string;
        };
        Relationships: [
          {
            foreignKeyName: "trip_calendar_feeds_trip_uuid_fkey";
            columns: ["trip_uuid"];
            isOneToOne: false;
            referencedRelation: "trips";
            referencedColumns: ["trip_uuid"];
          },
        ];
      };
      trip_documents: {
        Row: {
          created_at: string;
          created_by: string | null;
          document_type: string;
          expense_id: string | null;
          expires_on: string | null;
          file_name: string;
          id: string;
          mime_type: string | null;
          size_bytes: number | null;
          storage_path: string;
          travel_item_id: string | null;
          trip_id: string;
          trip_uuid: string;
          updated_by: string | null;
          workspace_user_id: string;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          document_type?: string;
          expense_id?: string | null;
          expires_on?: string | null;
          file_name: string;
          id?: string;
          mime_type?: string | null;
          size_bytes?: number | null;
          storage_path: string;
          travel_item_id?: string | null;
          trip_id: string;
          trip_uuid: string;
          updated_by?: string | null;
          workspace_user_id: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          document_type?: string;
          expense_id?: string | null;
          expires_on?: string | null;
          file_name?: string;
          id?: string;
          mime_type?: string | null;
          size_bytes?: number | null;
          storage_path?: string;
          travel_item_id?: string | null;
          trip_id?: string;
          trip_uuid?: string;
          updated_by?: string | null;
          workspace_user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "trip_documents_trip_uuid_fkey";
            columns: ["trip_uuid"];
            isOneToOne: false;
            referencedRelation: "trips";
            referencedColumns: ["trip_uuid"];
          },
          {
            foreignKeyName: "trip_documents_workspace_user_id_trip_id_fkey";
            columns: ["workspace_user_id", "trip_id"];
            isOneToOne: false;
            referencedRelation: "trips";
            referencedColumns: ["workspace_user_id", "id"];
          },
        ];
      };
      trip_expenses: {
        Row: {
          amount: number;
          billable: boolean;
          category: string;
          created_at: string;
          currency: string;
          expense_date: string;
          id: string;
          notes: string | null;
          paid_by: string;
          receipt_name: string | null;
          receipt_path: string | null;
          split_with: Json;
          title: string;
          trip_id: string;
          trip_uuid: string;
          updated_at: string;
          workspace_user_id: string;
        };
        Insert: {
          amount: number;
          billable?: boolean;
          category?: string;
          created_at?: string;
          currency?: string;
          expense_date: string;
          id: string;
          notes?: string | null;
          paid_by?: string;
          receipt_name?: string | null;
          receipt_path?: string | null;
          split_with?: Json;
          title: string;
          trip_id: string;
          trip_uuid: string;
          updated_at?: string;
          workspace_user_id: string;
        };
        Update: {
          amount?: number;
          billable?: boolean;
          category?: string;
          created_at?: string;
          currency?: string;
          expense_date?: string;
          id?: string;
          notes?: string | null;
          paid_by?: string;
          receipt_name?: string | null;
          receipt_path?: string | null;
          split_with?: Json;
          title?: string;
          trip_id?: string;
          trip_uuid?: string;
          updated_at?: string;
          workspace_user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "trip_expenses_trip_uuid_fkey";
            columns: ["trip_uuid"];
            isOneToOne: false;
            referencedRelation: "trips";
            referencedColumns: ["trip_uuid"];
          },
          {
            foreignKeyName: "trip_expenses_workspace_user_id_trip_id_fkey";
            columns: ["workspace_user_id", "trip_id"];
            isOneToOne: false;
            referencedRelation: "trips";
            referencedColumns: ["workspace_user_id", "id"];
          },
        ];
      };
      trip_invitations: {
        Row: {
          accepted_at: string | null;
          created_at: string;
          declined_at: string | null;
          email: string;
          expires_at: string;
          id: string;
          invited_by: string;
          revoked_at: string | null;
          role: string;
          sent_at: string | null;
          token_hash: string;
          trip_uuid: string;
        };
        Insert: {
          accepted_at?: string | null;
          created_at?: string;
          declined_at?: string | null;
          email: string;
          expires_at: string;
          id?: string;
          invited_by: string;
          revoked_at?: string | null;
          role: string;
          sent_at?: string | null;
          token_hash: string;
          trip_uuid: string;
        };
        Update: {
          accepted_at?: string | null;
          created_at?: string;
          declined_at?: string | null;
          email?: string;
          expires_at?: string;
          id?: string;
          invited_by?: string;
          revoked_at?: string | null;
          role?: string;
          sent_at?: string | null;
          token_hash?: string;
          trip_uuid?: string;
        };
        Relationships: [
          {
            foreignKeyName: "trip_invitations_trip_uuid_fkey";
            columns: ["trip_uuid"];
            isOneToOne: false;
            referencedRelation: "trips";
            referencedColumns: ["trip_uuid"];
          },
        ];
      };
      trip_itinerary_items: {
        Row: {
          day: string;
          id: string;
          notes: string | null;
          position: number;
          source_travel_item_id: string | null;
          title: string;
          trip_id: string;
          trip_uuid: string;
          workspace_user_id: string;
        };
        Insert: {
          day: string;
          id: string;
          notes?: string | null;
          position?: number;
          source_travel_item_id?: string | null;
          title: string;
          trip_id: string;
          trip_uuid: string;
          workspace_user_id: string;
        };
        Update: {
          day?: string;
          id?: string;
          notes?: string | null;
          position?: number;
          source_travel_item_id?: string | null;
          title?: string;
          trip_id?: string;
          trip_uuid?: string;
          workspace_user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "trip_itinerary_items_trip_uuid_fkey";
            columns: ["trip_uuid"];
            isOneToOne: false;
            referencedRelation: "trips";
            referencedColumns: ["trip_uuid"];
          },
          {
            foreignKeyName: "trip_itinerary_items_workspace_user_id_trip_id_fkey";
            columns: ["workspace_user_id", "trip_id"];
            isOneToOne: false;
            referencedRelation: "trips";
            referencedColumns: ["workspace_user_id", "id"];
          },
        ];
      };
      trip_members: {
        Row: {
          accepted_at: string | null;
          agency_client_id: string | null;
          email: string;
          id: string;
          invited_at: string;
          name: string;
          role: string;
          status: string;
          trip_id: string;
          trip_uuid: string;
          user_id: string | null;
          workspace_user_id: string;
        };
        Insert: {
          accepted_at?: string | null;
          agency_client_id?: string | null;
          email: string;
          id: string;
          invited_at?: string;
          name: string;
          role: string;
          status?: string;
          trip_id: string;
          trip_uuid: string;
          user_id?: string | null;
          workspace_user_id: string;
        };
        Update: {
          accepted_at?: string | null;
          agency_client_id?: string | null;
          email?: string;
          id?: string;
          invited_at?: string;
          name?: string;
          role?: string;
          status?: string;
          trip_id?: string;
          trip_uuid?: string;
          user_id?: string | null;
          workspace_user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "trip_members_agency_client_id_fkey";
            columns: ["agency_client_id"];
            isOneToOne: false;
            referencedRelation: "agency_clients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "trip_members_trip_uuid_fkey";
            columns: ["trip_uuid"];
            isOneToOne: false;
            referencedRelation: "trips";
            referencedColumns: ["trip_uuid"];
          },
          {
            foreignKeyName: "trip_members_workspace_user_id_trip_id_fkey";
            columns: ["workspace_user_id", "trip_id"];
            isOneToOne: false;
            referencedRelation: "trips";
            referencedColumns: ["workspace_user_id", "id"];
          },
        ];
      };
      trip_notification_preferences: {
        Row: {
          bookings: boolean;
          documents: boolean;
          expenses: boolean;
          flight_alerts: boolean;
          planning: boolean;
          trip_uuid: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          bookings?: boolean;
          documents?: boolean;
          expenses?: boolean;
          flight_alerts?: boolean;
          planning?: boolean;
          trip_uuid: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          bookings?: boolean;
          documents?: boolean;
          expenses?: boolean;
          flight_alerts?: boolean;
          planning?: boolean;
          trip_uuid?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "trip_notification_preferences_trip_uuid_fkey";
            columns: ["trip_uuid"];
            isOneToOne: false;
            referencedRelation: "trips";
            referencedColumns: ["trip_uuid"];
          },
        ];
      };
      trip_packing_items: {
        Row: {
          done: boolean;
          id: string;
          label: string;
          position: number;
          trip_id: string;
          trip_uuid: string;
          workspace_user_id: string;
        };
        Insert: {
          done?: boolean;
          id: string;
          label: string;
          position?: number;
          trip_id: string;
          trip_uuid: string;
          workspace_user_id: string;
        };
        Update: {
          done?: boolean;
          id?: string;
          label?: string;
          position?: number;
          trip_id?: string;
          trip_uuid?: string;
          workspace_user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "trip_packing_items_trip_uuid_fkey";
            columns: ["trip_uuid"];
            isOneToOne: false;
            referencedRelation: "trips";
            referencedColumns: ["trip_uuid"];
          },
          {
            foreignKeyName: "trip_packing_items_workspace_user_id_trip_id_fkey";
            columns: ["workspace_user_id", "trip_id"];
            isOneToOne: false;
            referencedRelation: "trips";
            referencedColumns: ["workspace_user_id", "id"];
          },
        ];
      };
      trip_settlement_requests: {
        Row: {
          amount: number;
          completed_at: string | null;
          created_at: string;
          created_by: string | null;
          currency: string;
          from_name: string;
          from_user_id: string;
          id: string;
          status: string;
          to_name: string;
          to_user_id: string;
          trip_uuid: string;
        };
        Insert: {
          amount: number;
          completed_at?: string | null;
          created_at?: string;
          created_by?: string | null;
          currency: string;
          from_name: string;
          from_user_id: string;
          id?: string;
          status?: string;
          to_name: string;
          to_user_id: string;
          trip_uuid: string;
        };
        Update: {
          amount?: number;
          completed_at?: string | null;
          created_at?: string;
          created_by?: string | null;
          currency?: string;
          from_name?: string;
          from_user_id?: string;
          id?: string;
          status?: string;
          to_name?: string;
          to_user_id?: string;
          trip_uuid?: string;
        };
        Relationships: [
          {
            foreignKeyName: "trip_settlement_requests_trip_uuid_fkey";
            columns: ["trip_uuid"];
            isOneToOne: false;
            referencedRelation: "trips";
            referencedColumns: ["trip_uuid"];
          },
        ];
      };
      trip_stops: {
        Row: {
          arrive_date: string | null;
          country: string;
          id: string;
          lat: number;
          lon: number;
          name: string;
          nights: number | null;
          position: number;
          trip_id: string;
          trip_uuid: string;
          workspace_user_id: string;
        };
        Insert: {
          arrive_date?: string | null;
          country?: string;
          id: string;
          lat: number;
          lon: number;
          name: string;
          nights?: number | null;
          position?: number;
          trip_id: string;
          trip_uuid: string;
          workspace_user_id: string;
        };
        Update: {
          arrive_date?: string | null;
          country?: string;
          id?: string;
          lat?: number;
          lon?: number;
          name?: string;
          nights?: number | null;
          position?: number;
          trip_id?: string;
          trip_uuid?: string;
          workspace_user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "trip_stops_trip_uuid_fkey";
            columns: ["trip_uuid"];
            isOneToOne: false;
            referencedRelation: "trips";
            referencedColumns: ["trip_uuid"];
          },
          {
            foreignKeyName: "trip_stops_workspace_user_id_trip_id_fkey";
            columns: ["workspace_user_id", "trip_id"];
            isOneToOne: false;
            referencedRelation: "trips";
            referencedColumns: ["workspace_user_id", "id"];
          },
        ];
      };
      trip_tasks: {
        Row: {
          assignee_name: string | null;
          completed: boolean;
          created_at: string;
          created_by: string | null;
          due_date: string | null;
          id: string;
          title: string;
          trip_uuid: string;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          assignee_name?: string | null;
          completed?: boolean;
          created_at?: string;
          created_by?: string | null;
          due_date?: string | null;
          id?: string;
          title: string;
          trip_uuid: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          assignee_name?: string | null;
          completed?: boolean;
          created_at?: string;
          created_by?: string | null;
          due_date?: string | null;
          id?: string;
          title?: string;
          trip_uuid?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "trip_tasks_trip_uuid_fkey";
            columns: ["trip_uuid"];
            isOneToOne: false;
            referencedRelation: "trips";
            referencedColumns: ["trip_uuid"];
          },
        ];
      };
      trip_travel_items: {
        Row: {
          amount: number | null;
          arrival: Json | null;
          booking_reference: string | null;
          created_at: string;
          currency: string | null;
          departure: Json | null;
          details: Json;
          end_date: string | null;
          expense_id: string | null;
          flight_number: string | null;
          flight_status: string | null;
          id: string;
          item_type: string;
          location: Json | null;
          notes: string | null;
          provider: string | null;
          start_date: string;
          title: string;
          trip_id: string;
          trip_uuid: string;
          updated_at: string;
          workspace_user_id: string;
        };
        Insert: {
          amount?: number | null;
          arrival?: Json | null;
          booking_reference?: string | null;
          created_at?: string;
          currency?: string | null;
          departure?: Json | null;
          details?: Json;
          end_date?: string | null;
          expense_id?: string | null;
          flight_number?: string | null;
          flight_status?: string | null;
          id: string;
          item_type: string;
          location?: Json | null;
          notes?: string | null;
          provider?: string | null;
          start_date: string;
          title: string;
          trip_id: string;
          trip_uuid: string;
          updated_at?: string;
          workspace_user_id: string;
        };
        Update: {
          amount?: number | null;
          arrival?: Json | null;
          booking_reference?: string | null;
          created_at?: string;
          currency?: string | null;
          departure?: Json | null;
          details?: Json;
          end_date?: string | null;
          expense_id?: string | null;
          flight_number?: string | null;
          flight_status?: string | null;
          id?: string;
          item_type?: string;
          location?: Json | null;
          notes?: string | null;
          provider?: string | null;
          start_date?: string;
          title?: string;
          trip_id?: string;
          trip_uuid?: string;
          updated_at?: string;
          workspace_user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "trip_travel_items_trip_uuid_fkey";
            columns: ["trip_uuid"];
            isOneToOne: false;
            referencedRelation: "trips";
            referencedColumns: ["trip_uuid"];
          },
          {
            foreignKeyName: "trip_travel_items_workspace_user_id_trip_id_fkey";
            columns: ["workspace_user_id", "trip_id"];
            isOneToOne: false;
            referencedRelation: "trips";
            referencedColumns: ["workspace_user_id", "id"];
          },
        ];
      };
      trips: {
        Row: {
          archived: boolean;
          budget: number;
          cover_path: string | null;
          created_at: string;
          description: string | null;
          end_date: string | null;
          id: string;
          is_public: boolean;
          name: string;
          revision: number;
          share_financials: boolean;
          share_pin_hash: string | null;
          start_date: string | null;
          template: string;
          travelers: Json;
          trip_uuid: string;
          updated_at: string;
          workspace_user_id: string;
          workspace_uuid: string;
        };
        Insert: {
          archived?: boolean;
          budget?: number;
          cover_path?: string | null;
          created_at?: string;
          description?: string | null;
          end_date?: string | null;
          id: string;
          is_public?: boolean;
          name: string;
          revision?: number;
          share_financials?: boolean;
          share_pin_hash?: string | null;
          start_date?: string | null;
          template?: string;
          travelers?: Json;
          trip_uuid?: string;
          updated_at?: string;
          workspace_user_id: string;
          workspace_uuid: string;
        };
        Update: {
          archived?: boolean;
          budget?: number;
          cover_path?: string | null;
          created_at?: string;
          description?: string | null;
          end_date?: string | null;
          id?: string;
          is_public?: boolean;
          name?: string;
          revision?: number;
          share_financials?: boolean;
          share_pin_hash?: string | null;
          start_date?: string | null;
          template?: string;
          travelers?: Json;
          trip_uuid?: string;
          updated_at?: string;
          workspace_user_id?: string;
          workspace_uuid?: string;
        };
        Relationships: [
          {
            foreignKeyName: "trips_workspace_user_id_fkey";
            columns: ["workspace_user_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "trips_workspace_uuid_fkey";
            columns: ["workspace_uuid"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["workspace_uuid"];
          },
        ];
      };
      worker_jobs: {
        Row: {
          actor_user_id: string | null;
          attempts: number;
          available_at: string;
          claimed_at: string | null;
          completed_at: string | null;
          created_at: string;
          id: string;
          idempotency_key: string;
          job_type: string;
          last_error_code: string | null;
          payload: Json;
          plan: string;
          provider: string;
          status: string;
          updated_at: string;
          workspace_uuid: string | null;
        };
        Insert: {
          actor_user_id?: string | null;
          attempts?: number;
          available_at?: string;
          claimed_at?: string | null;
          completed_at?: string | null;
          created_at?: string;
          id?: string;
          idempotency_key: string;
          job_type: string;
          last_error_code?: string | null;
          payload?: Json;
          plan: string;
          provider: string;
          status?: string;
          updated_at?: string;
          workspace_uuid?: string | null;
        };
        Update: {
          actor_user_id?: string | null;
          attempts?: number;
          available_at?: string;
          claimed_at?: string | null;
          completed_at?: string | null;
          created_at?: string;
          id?: string;
          idempotency_key?: string;
          job_type?: string;
          last_error_code?: string | null;
          payload?: Json;
          plan?: string;
          provider?: string;
          status?: string;
          updated_at?: string;
          workspace_uuid?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "worker_jobs_provider_fkey";
            columns: ["provider"];
            isOneToOne: false;
            referencedRelation: "platform_provider_controls";
            referencedColumns: ["provider"];
          },
          {
            foreignKeyName: "worker_jobs_workspace_uuid_fkey";
            columns: ["workspace_uuid"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["workspace_uuid"];
          },
        ];
      };
      workspace_invitations: {
        Row: {
          accepted_at: string | null;
          created_at: string;
          declined_at: string | null;
          email: string;
          expires_at: string;
          id: string;
          invited_by: string;
          revoked_at: string | null;
          role: string;
          token_hash: string;
          workspace_uuid: string;
        };
        Insert: {
          accepted_at?: string | null;
          created_at?: string;
          declined_at?: string | null;
          email: string;
          expires_at: string;
          id?: string;
          invited_by: string;
          revoked_at?: string | null;
          role: string;
          token_hash: string;
          workspace_uuid: string;
        };
        Update: {
          accepted_at?: string | null;
          created_at?: string;
          declined_at?: string | null;
          email?: string;
          expires_at?: string;
          id?: string;
          invited_by?: string;
          revoked_at?: string | null;
          role?: string;
          token_hash?: string;
          workspace_uuid?: string;
        };
        Relationships: [
          {
            foreignKeyName: "workspace_invitations_workspace_uuid_fkey";
            columns: ["workspace_uuid"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["workspace_uuid"];
          },
        ];
      };
      workspace_members: {
        Row: {
          invited_at: string;
          joined_at: string | null;
          permission_overrides: Json;
          role: string;
          status: string;
          updated_at: string;
          user_id: string;
          workspace_uuid: string;
        };
        Insert: {
          invited_at?: string;
          joined_at?: string | null;
          permission_overrides?: Json;
          role: string;
          status?: string;
          updated_at?: string;
          user_id: string;
          workspace_uuid: string;
        };
        Update: {
          invited_at?: string;
          joined_at?: string | null;
          permission_overrides?: Json;
          role?: string;
          status?: string;
          updated_at?: string;
          user_id?: string;
          workspace_uuid?: string;
        };
        Relationships: [
          {
            foreignKeyName: "workspace_members_workspace_uuid_fkey";
            columns: ["workspace_uuid"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["workspace_uuid"];
          },
        ];
      };
      workspaces: {
        Row: {
          base_currency: string;
          branding: Json;
          created_at: string;
          data: Json;
          data_migrated_at: string | null;
          plan: string;
          public_token: string;
          share_enabled: boolean;
          share_financials: boolean;
          share_pin_hash: string | null;
          updated_at: string;
          user_id: string;
          workspace_uuid: string;
        };
        Insert: {
          base_currency?: string;
          branding?: Json;
          created_at?: string;
          data?: Json;
          data_migrated_at?: string | null;
          plan?: string;
          public_token?: string;
          share_enabled?: boolean;
          share_financials?: boolean;
          share_pin_hash?: string | null;
          updated_at?: string;
          user_id: string;
          workspace_uuid?: string;
        };
        Update: {
          base_currency?: string;
          branding?: Json;
          created_at?: string;
          data?: Json;
          data_migrated_at?: string | null;
          plan?: string;
          public_token?: string;
          share_enabled?: boolean;
          share_financials?: boolean;
          share_pin_hash?: string | null;
          updated_at?: string;
          user_id?: string;
          workspace_uuid?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      accept_trip_invitation: {
        Args: { p_token_hash: string; p_user_id: string };
        Returns: Json;
      };
      apply_paddle_one_time_purchase: {
        Args: { p_event: Json };
        Returns: string;
      };
      claim_billing_webhooks: {
        Args: { p_limit?: number };
        Returns: {
          attempts: number;
          event_type: string;
          id: string;
          last_error_code: string | null;
          notification_id: string | null;
          occurred_at: string;
          payload: Json;
          processed_at: string | null;
          provider: string;
          provider_event_id: string;
          received_at: string;
          status: string;
        }[];
        SetofOptions: {
          from: "*";
          to: "billing_webhook_events";
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      claim_corporate_mail_queue: {
        Args: { p_limit?: number };
        Returns: {
          attempts: number;
          available_at: string;
          body_html: string | null;
          body_text: string;
          cc_addresses: string[];
          claimed_at: string | null;
          created_at: string;
          created_by: string;
          id: string;
          in_reply_to_message_id: string | null;
          last_error_code: string | null;
          mailbox_id: string;
          recipient_addresses: string[];
          sent_at: string | null;
          status: string;
          subject: string;
          updated_at: string;
        }[];
        SetofOptions: {
          from: "*";
          to: "corporate_mail_send_queue";
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      claim_email_outbox: {
        Args: { p_limit?: number };
        Returns: {
          attempts: number;
          available_at: string;
          claimed_at: string | null;
          created_at: string;
          id: string;
          invitation_action_url: string | null;
          invitation_id: string | null;
          invitation_type: string | null;
          last_error_code: string | null;
          locale: string;
          notification_id: string | null;
          payload: Json;
          recipient_email: string;
          sent_at: string | null;
          status: string;
          template_key: string;
          updated_at: string;
          user_id: string | null;
        }[];
        SetofOptions: {
          from: "*";
          to: "email_outbox";
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      claim_worker_jobs: {
        Args: { p_limit?: number };
        Returns: {
          actor_user_id: string | null;
          attempts: number;
          available_at: string;
          claimed_at: string | null;
          completed_at: string | null;
          created_at: string;
          id: string;
          idempotency_key: string;
          job_type: string;
          last_error_code: string | null;
          payload: Json;
          plan: string;
          provider: string;
          status: string;
          updated_at: string;
          workspace_uuid: string | null;
        }[];
        SetofOptions: {
          from: "*";
          to: "worker_jobs";
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      complete_worker_job: {
        Args: { p_error_code?: string; p_job_id: string; p_succeeded: boolean };
        Returns: boolean;
      };
      consume_external_api_quota: {
        Args: {
          p_actor_user_id: string;
          p_daily_limit: number;
          p_provider: string;
          p_workspace_uuid: string;
        };
        Returns: Json;
      };
      consume_flight_lookup_quota: {
        Args: { p_limit?: number; p_user_id: string };
        Returns: boolean;
      };
      convert_agency_quote: {
        Args: {
          p_actor_id: string;
          p_quote_id: string;
          p_trip: Json;
          p_workspace_uuid: string;
        };
        Returns: string;
      };
      decline_trip_invitation: {
        Args: { p_token_hash: string; p_user_id: string };
        Returns: Json;
      };
      delete_trip_versioned: {
        Args: {
          p_revision: string;
          p_trip_id: string;
          p_workspace_user_id: string;
        };
        Returns: undefined;
      };
      enqueue_worker_job: {
        Args: {
          p_actor_user_id: string;
          p_idempotency_key: string;
          p_job_type: string;
          p_payload: Json;
          p_plan: string;
          p_provider: string;
          p_workspace_uuid: string;
        };
        Returns: string;
      };
      expire_billing_entitlements: { Args: never; Returns: number };
      get_agency_notification_preferences: {
        Args: { p_user_id: string };
        Returns: Json;
      };
      get_agency_permissions: { Args: { p_owner_id: string }; Returns: Json };
      get_agency_settings: { Args: { p_owner_id: string }; Returns: Json };
      get_public_platform_status: { Args: never; Returns: Json };
      get_public_trip: {
        Args: { p_pin_hash?: string; p_token: string; p_trip_id: string };
        Returns: Json;
      };
      get_public_trip_branding: {
        Args: { p_token: string; p_trip_id: string };
        Returns: Json;
      };
      get_trip_branding: {
        Args: { p_actor_id: string; p_trip_uuid: string };
        Returns: Json;
      };
      get_trip_calendar_feed: { Args: { p_token: string }; Returns: Json };
      get_trip_notification_preferences: {
        Args: { p_actor_id: string; p_trip_uuid: string };
        Returns: Json;
      };
      list_public_testimonials: { Args: never; Returns: Json };
      list_public_trip_cards: { Args: never; Returns: Json };
      manage_trip_invitation: {
        Args: {
          p_action: string;
          p_invitation_id: string;
          p_owner_id: string;
          p_token_hash?: string;
          p_trip_uuid: string;
        };
        Returns: Json;
      };
      manage_workspace_invitation: {
        Args: {
          p_action: string;
          p_invitation_id: string;
          p_owner_id: string;
          p_token_hash?: string;
        };
        Returns: Json;
      };
      manage_workspace_member: {
        Args: {
          p_action: string;
          p_member_user_id: string;
          p_owner_id: string;
          p_role?: string;
        };
        Returns: Json;
      };
      prepare_agency_quote_share: {
        Args: {
          p_actor_id: string;
          p_expires_at: string;
          p_quote_id: string;
          p_token_hash: string;
          p_workspace_uuid: string;
        };
        Returns: string;
      };
      process_paddle_billing_event: { Args: { p_event: Json }; Returns: string };
      publish_platform_announcement: {
        Args: {
          p_actor_id: string;
          p_announcement_type: string;
          p_body_en: string;
          p_body_nl: string;
          p_severity: string;
          p_title_en: string;
          p_title_nl: string;
        };
        Returns: string;
      };
      publish_platform_announcement_v2: {
        Args: {
          p_actor_id: string;
          p_announcement_type: string;
          p_body_en: string;
          p_body_nl: string;
          p_severity: string;
          p_status_key?: string;
          p_title_en: string;
          p_title_nl: string;
        };
        Returns: string;
      };
      publish_trip_settlement: {
        Args: {
          p_action: string;
          p_actor: string;
          p_currency: string;
          p_transfers?: Json;
          p_trip: string;
        };
        Returns: Json;
      };
      remove_trip_member: {
        Args: { p_member_id: string; p_owner_id: string; p_trip_uuid: string };
        Returns: boolean;
      };
      respond_agency_quote: {
        Args: {
          p_note?: string;
          p_response: string;
          p_token_hash: string;
          p_variant_id?: string;
        };
        Returns: Json;
      };
      respond_workspace_invitation: {
        Args: { p_response: string; p_token_hash: string; p_user_id: string };
        Returns: Json;
      };
      revoke_agency_quote_share: {
        Args: {
          p_actor_id: string;
          p_quote_id: string;
          p_workspace_uuid: string;
        };
        Returns: boolean;
      };
      run_notification_maintenance: { Args: { p_now?: string }; Returns: Json };
      save_agency_client: {
        Args: {
          p_actor_id: string;
          p_client: Json;
          p_client_id: string;
          p_trip_ids?: string[];
          p_workspace_uuid: string;
        };
        Returns: string;
      };
      save_agency_delivery_settings: {
        Args: {
          p_actor: string;
          p_domain: Json;
          p_mail: Json;
          p_workspace: string;
        };
        Returns: Json;
      };
      save_agency_member_permissions: {
        Args: {
          p_member_user_id: string;
          p_overrides: Json;
          p_owner_id: string;
        };
        Returns: boolean;
      };
      save_agency_notification_preferences: {
        Args: { p_preferences: Json; p_user_id: string };
        Returns: boolean;
      };
      save_agency_quote: {
        Args: {
          p_actor_id: string;
          p_payload: Json;
          p_quote_id: string;
          p_variants: Json;
          p_workspace_uuid: string;
        };
        Returns: string;
      };
      save_agency_role_permissions: {
        Args: { p_owner_id: string; p_permissions: Json; p_role: string };
        Returns: boolean;
      };
      save_agency_settings: {
        Args: { p_owner_id: string; p_settings: Json };
        Returns: Json;
      };
      save_agency_supplier: {
        Args: {
          p_actor_id: string;
          p_supplier: Json;
          p_supplier_id: string;
          p_trip_ids: string[];
          p_workspace_uuid: string;
        };
        Returns: string;
      };
      save_trip_branding: {
        Args: { p_actor_id: string; p_branding: Json; p_trip_uuid: string };
        Returns: boolean;
      };
      save_trip_notification_preferences: {
        Args: { p_actor_id: string; p_preferences: Json; p_trip_uuid: string };
        Returns: boolean;
      };
      save_trip_snapshot: {
        Args: { p_trip: Json; p_workspace_user_id: string };
        Returns: {
          trip_uuid: string;
          updated_at: string;
        }[];
      };
      save_trip_snapshot_versioned: {
        Args: { p_trip: Json; p_workspace_user_id: string };
        Returns: {
          revision: string;
          trip_uuid: string;
        }[];
      };
      save_trip_snapshot_versioned_as: {
        Args: {
          p_actor_user_id: string;
          p_trip: Json;
          p_workspace_user_id: string;
        };
        Returns: {
          revision: string;
          trip_uuid: string;
        }[];
      };
      set_agency_client_archived: {
        Args: {
          p_actor_id: string;
          p_archived: boolean;
          p_client_id: string;
          p_workspace_uuid: string;
        };
        Returns: boolean;
      };
      set_agency_supplier_archived: {
        Args: {
          p_actor_id: string;
          p_archived: boolean;
          p_supplier_id: string;
          p_workspace_uuid: string;
        };
        Returns: boolean;
      };
      set_email_delivery_mode: {
        Args: { p_actor: string; p_mode: string; p_release_held: boolean };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
