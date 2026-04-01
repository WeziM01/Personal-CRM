export type Json =
	| string
	| number
	| boolean
	| null
	| { [key: string]: Json | undefined }
	| Json[];

export type Database = {
	public: {
		Tables: {
			events: {
				Row: {
					created_at: string;
					id: string;
					name: string;
					user_id: string;
				};
				Insert: {
					created_at?: string;
					id?: string;
					name: string;
					user_id: string;
				};
				Update: {
					created_at?: string;
					id?: string;
					name?: string;
					user_id?: string;
				};
				Relationships: [
					{
						foreignKeyName: "events_user_id_fkey";
						columns: ["user_id"];
						isOneToOne: false;
						referencedRelation: "users";
						referencedColumns: ["id"];
					},
				];
			};
			persons: {
				Row: {
					created_at: string;
					id: string;
					name: string | null;
					photo_url: string | null;
					user_id: string;
				};
				Insert: {
					created_at?: string;
					id?: string;
					name?: string | null;
					photo_url?: string | null;
					user_id: string;
				};
				Update: {
					created_at?: string;
					id?: string;
					name?: string | null;
					photo_url?: string | null;
					user_id?: string;
				};
				Relationships: [
					{
						foreignKeyName: "persons_user_id_fkey";
						columns: ["user_id"];
						isOneToOne: false;
						referencedRelation: "users";
						referencedColumns: ["id"];
					},
				];
			};
			interactions: {
				Row: {
					created_at: string;
					event_id: string | null;
					id: string;
					person_id: string;
					raw_note: string;
					user_id: string;
				};
				Insert: {
					created_at?: string;
					event_id?: string | null;
					id?: string;
					person_id: string;
					raw_note: string;
					user_id: string;
				};
				Update: {
					created_at?: string;
					event_id?: string | null;
					id?: string;
					person_id?: string;
					raw_note?: string;
					user_id?: string;
				};
				Relationships: [
					{
						foreignKeyName: "interactions_event_id_fkey";
						columns: ["event_id"];
						isOneToOne: false;
						referencedRelation: "events";
						referencedColumns: ["id"];
					},
					{
						foreignKeyName: "interactions_person_id_fkey";
						columns: ["person_id"];
						isOneToOne: false;
						referencedRelation: "persons";
						referencedColumns: ["id"];
					},
					{
						foreignKeyName: "interactions_user_id_fkey";
						columns: ["user_id"];
						isOneToOne: false;
						referencedRelation: "users";
						referencedColumns: ["id"];
					},
				];
			};
		};
		Views: {
			[_ in never]: never;
		};
		Functions: {
			[_ in never]: never;
		};
		Enums: {
			[_ in never]: never;
		};
		CompositeTypes: {
			[_ in never]: never;
		};
	};
	auth: {
		Tables: {
			users: {
				Row: {
					id: string;
				};
				Insert: {
					id: string;
				};
				Update: {
					id?: string;
				};
				Relationships: [];
			};
		};
		Views: {
			[_ in never]: never;
		};
		Functions: {
			[_ in never]: never;
		};
		Enums: {
			[_ in never]: never;
		};
		CompositeTypes: {
			[_ in never]: never;
		};
	};
};
