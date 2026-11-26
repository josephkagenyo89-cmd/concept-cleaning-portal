import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
type Profile={id:string;user_id:string;full_name:string;email:string|null;phone:string;address:string;county:string;avatar_url:string|null;membership_tier:string;loyalty_points:number;lifetime_spend:number;total_bookings:number;referral_code:string|null};
type AuthCtx={user:User|null;session:Session|null;profile:Profile|null;isAdmin:boolean;loading:boolean;signOut:()=>Promise<void>;refreshProfile:()=>Promise<void>};
const Ctx=createContext<AuthCtx|undefined>(undefined);
export const AuthProvider=({children}:{children:ReactNode})=>{
 const [user,setUser]=useState<User|null>(null),[session,setSession]=useState<Session|null>(null),[profile,setProfile]=useState<Profile|null>(null),[isAdmin,setIsAdmin]=useState(false),[loading,setLoading]=useState(true);
 const loadExtras=async(uid:string,authUser?:User)=>{
  const [{data:roles},{data:client,error:clientError}]=await Promise.all([supabase.from("user_roles").select("role").eq("user_id",uid),supabase.from("clients").select("*").eq("user_id",uid).maybeSingle()]);
  setIsAdmin((roles??[]).some((r:any)=>r.role==="admin"||r.role==="super_admin"));let currentClient:any=client;
  if(clientError)console.error("Unable to load customer CRM record",clientError);
  if(!currentClient&&authUser){const meta=(authUser.user_metadata??{}) as Record<string,string>;const phone=(meta.phone??"").trim();if(phone){
   const {data:created,error}=await supabase.from("clients").insert({full_name:meta.full_name||authUser.email||"Customer",phone,whatsapp_number:phone,location:meta.location||"",email:authUser.email??null,status:"new",created_by:uid,created_by_role:"customer",user_id:uid}).select("*").maybeSingle();
   if(error)console.warn("CRM customer record requires verified staff linking",error);else currentClient=created;
  }}
  if(!currentClient){setProfile(null);return;}
  const referralCode=(authUser?.user_metadata as Record<string,string>|undefined)?.referral_code;
  if(referralCode){const {error:referralError}=await supabase.rpc("register_customer_referral",{p_referral_code:referralCode});if(referralError)console.info("Referral code was not applied",referralError.message);}
  const {data:loyalty}=await supabase.from("customer_loyalty_accounts").select("membership_tier,points_balance,lifetime_spend,referral_code").eq("user_id",uid).maybeSingle();
  setProfile({id:currentClient.id,user_id:uid,full_name:currentClient.full_name??"",email:currentClient.email??authUser?.email??null,phone:currentClient.phone??"",address:currentClient.location??"",county:currentClient.county??"",avatar_url:null,membership_tier:loyalty?.membership_tier??"Silver",loyalty_points:Number(loyalty?.points_balance??0),lifetime_spend:Number(loyalty?.lifetime_spend??currentClient.total_spend??0),total_bookings:Number(currentClient.booking_count??0),referral_code:loyalty?.referral_code??null});
 };
 useEffect(()=>{let mounted=true;const apply=async(s:Session|null)=>{if(!mounted)return;setSession(s);setUser(s?.user??null);if(s?.user){await loadExtras(s.user.id,s.user);if(mounted)setLoading(false);}else{setProfile(null);setIsAdmin(false);if(mounted)setLoading(false);}};
  supabase.auth.getSession().then(({data})=>apply(data.session));const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,s)=>{void apply(s);});return()=>{mounted=false;subscription.unsubscribe();};
 },[]);
 const refreshProfile=async()=>{if(user)await loadExtras(user.id,user);};
 return <Ctx.Provider value={{user,session,profile,isAdmin,loading,signOut:async()=>{await supabase.auth.signOut();},refreshProfile}}>{children}</Ctx.Provider>;
};
export const useAuth=()=>{const c=useContext(Ctx);if(!c)throw new Error("useAuth must be used within AuthProvider");return c;};
