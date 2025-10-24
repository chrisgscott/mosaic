#!/usr/bin/env python3
"""
Clear all entities and relationships from the database.
Use with caution - this will delete ALL graph data!
"""

import os
from supabase import create_client, Client
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

def clear_all_entities():
    """Clear all entities and relationships from the database"""
    
    # Initialize Supabase client
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    
    if not supabase_url or not supabase_key:
        print("❌ Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set")
        return
    
    supabase: Client = create_client(supabase_url, supabase_key)
    
    print("🗑️  Clearing all entities and relationships from database...")
    print("⚠️  This will delete ALL graph data!")
    
    # Confirm
    response = input("\nAre you sure you want to continue? (yes/no): ")
    if response.lower() != "yes":
        print("❌ Aborted")
        return
    
    try:
        # Step 1: Delete all relationships first (due to foreign key constraints)
        print("\n1️⃣  Deleting all relationships...")
        result = supabase.table("relationships").delete().neq("id", "00000000-0000-0000-0000-000000000000").execute()
        rel_count = len(result.data) if result.data else 0
        print(f"   ✅ Deleted {rel_count} relationships")
        
        # Step 2: Delete all entities
        print("\n2️⃣  Deleting all entities...")
        result = supabase.table("entities").delete().neq("id", "00000000-0000-0000-0000-000000000000").execute()
        entity_count = len(result.data) if result.data else 0
        print(f"   ✅ Deleted {entity_count} entities")
        
        print("\n✅ Successfully cleared all graph data!")
        print(f"   Total deleted: {entity_count} entities, {rel_count} relationships")
        
    except Exception as e:
        print(f"\n❌ Error clearing entities: {e}")
        return

if __name__ == "__main__":
    clear_all_entities()
