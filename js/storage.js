
const PPStore = (() => {
  const cache = {
    applications: [],
    questions: [],
    settings: {
      recruitmentOpen: true,
      minimumScore: 4,
      retryDays: 7,
      showPublicReason: false
    },
    users: [],
    announcements: [],
    auditLogs: [],
    currentUser: null
  };

  const defaultPermissions = {
    recruiter: {
      dashboard_view:true,candidates_view:true,candidates_review:true,
      candidates_approve:true,candidates_reject:true,interviews_manage:true,
      questions_view:true,questions_manage:false,settings_manage:false,
      staff_manage:false,audit_view:false,applications_delete:false,
      announcements_manage:false
    },
    supervisor: {
      dashboard_view:true,candidates_view:true,candidates_review:true,
      candidates_approve:true,candidates_reject:true,interviews_manage:true,
      questions_view:true,questions_manage:true,settings_manage:false,
      staff_manage:false,audit_view:true,applications_delete:false,
      announcements_manage:true
    },
    admin: {
      dashboard_view:true,candidates_view:true,candidates_review:true,
      candidates_approve:true,candidates_reject:true,interviews_manage:true,
      questions_view:true,questions_manage:true,settings_manage:true,
      staff_manage:true,audit_view:true,applications_delete:true,
      announcements_manage:true
    }
  };

  const assertConfigured = () => {
    if (!window.SUPABASE_CONFIGURED || !window.supabaseClient) {
      throw new Error("Supabase não configurado. Preencha supabase/config.js.");
    }
  };

  const camelApplication = row => ({
    id: row.id,
    userId: row.user_id,
    protocol: row.protocol,
    characterName: row.character_name,
    passport: row.passport,
    discord: row.discord,
    characterAge: row.character_age,
    cityTime: row.city_time,
    availability: row.availability,
    experience: row.experience,
    answers: row.answers || {},
    autoScore: row.automatic_score || 0,
    manualScore: row.manual_score,
    maxAutoScore: row.maximum_automatic_score || 0,
    status: row.status,
    publicNote: row.public_note || "",
    reviewerNotes: row.reviewer_notes || "",
    reviewerId: row.reviewer_id,
    physicalRecruiter: row.physical_recruiter || "",
    eliminatory: !!row.eliminatory_triggered,
    questionSnapshot: row.question_snapshot || [],
    timeline: row.timeline || [],
    createdAt: row.created_at,
    updatedAt: row.updated_at
  });

  const dbApplication = app => ({
    protocol: app.protocol,
    character_name: app.characterName,
    passport: app.passport,
    discord: app.discord,
    character_age: app.characterAge,
    city_time: app.cityTime,
    availability: app.availability,
    experience: app.experience,
    answers: app.answers || {},
    automatic_score: app.autoScore || 0,
    manual_score: app.manualScore,
    maximum_automatic_score: app.maxAutoScore || 0,
    status: app.status,
    public_note: app.publicNote || "",
    reviewer_notes: app.reviewerNotes || "",
    physical_recruiter: app.physicalRecruiter || "",
    eliminatory_triggered: !!app.eliminatory,
    question_snapshot: app.questionSnapshot || [],
    timeline: app.timeline || []
  });

  const camelQuestion = row => ({
    id: row.id,
    title: row.title,
    description: row.description || "",
    category: row.category,
    type: row.question_type,
    required: row.required,
    active: row.active,
    order: row.order_position,
    points: row.points,
    options: row.options || [],
    correctOption: row.correct_option || "",
    eliminatoryOptions: row.eliminatory_options || [],
    minLength: row.min_length || 0,
    manualCriteria: row.manual_criteria || ""
  });

  const dbQuestion = q => ({
    id: q.id,
    title: q.title,
    description: q.description || "",
    category: q.category || "Geral",
    question_type: q.type,
    required: q.required !== false,
    active: q.active !== false,
    order_position: q.order,
    points: Number(q.points || 0),
    options: q.options || [],
    correct_option: q.correctOption || null,
    eliminatory_options: q.eliminatoryOptions || [],
    min_length: Number(q.minLength || 0),
    manual_criteria: q.manualCriteria || ""
  });

  const camelProfile = row => ({
    id: row.id,
    name: row.display_name || row.email || "Usuário",
    username: row.username || "",
    email: row.email || "",
    discord: row.discord || "",
    role: row.role,
    active: row.active,
    permissions: row.permissions || defaultPermissions[row.role] || {},
    lastLogin: row.last_login,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  });

  const camelAnnouncement = row => ({
    id: row.id,
    title: row.title,
    message: row.message,
    audienceStatus: row.audience_status,
    active: row.active,
    createdBy: row.created_by_name || "",
    createdAt: row.created_at,
    updatedAt: row.updated_at
  });

  const camelAudit = row => ({
    id: row.id,
    actorId: row.actor_id,
    actorName: row.actor_name || "Sistema",
    actorRole: row.actor_role || "system",
    action: row.action,
    resourceType: row.resource_type,
    resourceId: row.resource_id,
    oldData: row.old_data,
    newData: row.new_data,
    createdAt: row.created_at
  });

  const initializePublic = async () => {
    assertConfigured();
    const [{ data: questions, error: qe }, { data: settings, error: se }] = await Promise.all([
      supabaseClient.from("recruitment_questions").select("*").eq("active", true).order("order_position"),
      supabaseClient.from("recruitment_settings").select("*").eq("id", 1).maybeSingle()
    ]);
    if (qe) throw qe;
    if (se) throw se;
    cache.questions = (questions || []).map(camelQuestion);
    if (settings) {
      cache.settings = {
        recruitmentOpen: settings.recruitment_open,
        minimumScore: settings.minimum_score,
        retryDays: settings.retry_days,
        showPublicReason: settings.show_public_reason
      };
    }
  };

  const initializeStaff = async () => {
    assertConfigured();
    const { data: authData, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !authData?.user) {
      cache.currentUser = null;
      return false;
    }

    const { data: profile, error: profileError } = await supabaseClient
      .from("profiles").select("*").eq("id", authData.user.id).single();
    if (profileError) throw profileError;
    cache.currentUser = camelProfile(profile);
    if (!cache.currentUser.active) {
      await supabaseClient.auth.signOut();
      cache.currentUser = null;
      return false;
    }

    const tasks = [
      supabaseClient.from("recruitment_applications").select("*").order("created_at", {ascending:false}),
      supabaseClient.from("recruitment_questions").select("*").order("order_position"),
      supabaseClient.from("recruitment_settings").select("*").eq("id",1).maybeSingle(),
      supabaseClient.from("announcements").select("*").order("created_at",{ascending:false})
    ];

    if (cache.currentUser.permissions.staff_manage) {
      tasks.push(supabaseClient.from("profiles").select("*").order("created_at"));
    } else tasks.push(Promise.resolve({data:[],error:null}));

    if (cache.currentUser.permissions.audit_view) {
      tasks.push(supabaseClient.from("audit_logs").select("*").order("created_at",{ascending:false}).limit(500));
    } else tasks.push(Promise.resolve({data:[],error:null}));

    const [apps, questions, settings, announcements, users, audits] = await Promise.all(tasks);
    for (const result of [apps,questions,settings,announcements,users,audits]) {
      if (result.error) throw result.error;
    }

    cache.applications = (apps.data || []).map(camelApplication);
    cache.questions = (questions.data || []).map(camelQuestion);
    cache.announcements = (announcements.data || []).map(camelAnnouncement);
    cache.users = (users.data || []).map(camelProfile);
    cache.auditLogs = (audits.data || []).map(camelAudit);
    if (settings.data) {
      cache.settings = {
        recruitmentOpen: settings.data.recruitment_open,
        minimumScore: settings.data.minimum_score,
        retryDays: settings.data.retry_days,
        showPublicReason: settings.data.show_public_reason
      };
    }
    return true;
  };

  const applications = () => cache.applications;
  const questions = () => cache.questions;
  const settings = () => cache.settings;
  const users = () => cache.users;
  const announcements = () => cache.announcements;
  const auditLogs = () => cache.auditLogs;
  const currentUser = () => cache.currentUser;

  const hasAdminSession = () => !!cache.currentUser;
  const hasPermission = permission => !!cache.currentUser?.active && !!cache.currentUser.permissions?.[permission];

  const loginStaff = async (email, password) => {
    assertConfigured();
    const { data, error } = await supabaseClient.auth.signInWithPassword({email, password});
    if (error) return {ok:false, reason:"invalid", error};
    const ok = await initializeStaff();
    if (!ok) return {ok:false, reason:"inactive"};
    await addAudit("login","staff",data.user.id,null,{email});
    return {ok:true,user:cache.currentUser};
  };

  const logoutStaff = async () => {
    if (window.supabaseClient) await supabaseClient.auth.signOut();
    cache.currentUser = null;
  };

  const needsInitialSetup = async () => {
    assertConfigured();
    const { data, error } = await supabaseClient.rpc("needs_initial_admin");
    if (error) throw error;
    return !!data;
  };

  const createInitialAdmin = async data => {
    assertConfigured();
    const { data: signup, error: signupError } = await supabaseClient.auth.signUp({
      email:data.email,
      password:data.password,
      options:{data:{display_name:data.name,username:data.username,discord:data.discord}}
    });
    if (signupError) return {ok:false,reason:"signup",error:signupError};
    if (!signup.user) return {ok:false,reason:"email_confirmation"};

    const { data: result, error } = await supabaseClient.rpc("bootstrap_first_admin", {
      p_display_name:data.name,
      p_username:data.username,
      p_discord:data.discord
    });
    if (error) return {ok:false,reason:"bootstrap",error};
    return {ok:!!result,user:signup.user};
  };

  const generateProtocol = () => {
    const year = new Date().getFullYear();
    const random = crypto.getRandomValues(new Uint32Array(1))[0].toString().slice(-6);
    return `PP-${year}-${random.padStart(6,"0")}`;
  };

  const createApplication = async app => {
    assertConfigured();
    const payload = dbApplication(app);
    const { data, error } = await supabaseClient.rpc("submit_recruitment_application", {
      p_application: payload
    });
    if (error) throw error;
    const created = camelApplication(data);
    cache.applications.unshift(created);
    return created;
  };

  const findByProtocol = async (protocol, passport) => {
    assertConfigured();
    const { data, error } = await supabaseClient.rpc("lookup_recruitment_application", {
      p_protocol: String(protocol).trim(),
      p_passport: String(passport).trim()
    });
    if (error) throw error;
    return data ? camelApplication(data) : null;
  };

  const updateApplication = async (id, patch) => {
    assertConfigured();
    const current = cache.applications.find(a=>a.id===id);
    if (!current) return null;
    const merged = {...current,...patch};
    const { data, error } = await supabaseClient
      .from("recruitment_applications")
      .update(dbApplication(merged))
      .eq("id",id).select().single();
    if (error) throw error;
    const updated = camelApplication(data);
    const index = cache.applications.findIndex(a=>a.id===id);
    cache.applications[index] = updated;
    return updated;
  };

  const saveQuestions = async list => {
    assertConfigured();
    const payload = list.map(dbQuestion);
    const { error } = await supabaseClient.from("recruitment_questions").upsert(payload);
    if (error) throw error;
    cache.questions = list;
  };

  const deleteQuestion = async id => {
    const { error } = await supabaseClient.from("recruitment_questions").delete().eq("id",id);
    if (error) throw error;
    cache.questions = cache.questions.filter(q=>q.id!==id);
  };

  const saveSettings = async value => {
    const payload = {
      id:1,
      recruitment_open:value.recruitmentOpen,
      minimum_score:value.minimumScore,
      retry_days:value.retryDays,
      show_public_reason:value.showPublicReason,
      updated_at:new Date().toISOString()
    };
    const { error } = await supabaseClient.from("recruitment_settings").upsert(payload);
    if (error) throw error;
    cache.settings = value;
  };

  const createAnnouncement = async data => {
    const payload = {
      title:data.title.trim(),message:data.message.trim(),
      audience_status:data.audienceStatus,active:data.active!==false,
      created_by:cache.currentUser.id
    };
    const { data: row, error } = await supabaseClient.from("announcements").insert(payload).select().single();
    if (error) throw error;
    const item = camelAnnouncement({...row,created_by_name:cache.currentUser.name});
    cache.announcements.unshift(item);
    return item;
  };

  const updateAnnouncement = async (id, patch) => {
    const payload = {
      title:patch.title,message:patch.message,
      audience_status:patch.audienceStatus,active:patch.active,
      updated_at:new Date().toISOString()
    };
    const { data, error } = await supabaseClient.from("announcements").update(payload).eq("id",id).select().single();
    if (error) throw error;
    const item = camelAnnouncement({...data,created_by_name:cache.currentUser.name});
    const index=cache.announcements.findIndex(a=>a.id===id);
    cache.announcements[index]=item;
    return item;
  };

  const deleteAnnouncement = async id => {
    const { error } = await supabaseClient.from("announcements").delete().eq("id",id);
    if (error) throw error;
    cache.announcements=cache.announcements.filter(a=>a.id!==id);
    return true;
  };

  const announcementsForStatus = status =>
    cache.announcements.filter(item=>item.active&&(item.audienceStatus===status||item.audienceStatus==="Todos"));

  const addAudit = async (action,resourceType,resourceId,oldData=null,newData=null) => {
    if (!cache.currentUser) return;
    const payload = {
      actor_id:cache.currentUser.id,
      actor_name:cache.currentUser.name,
      actor_role:cache.currentUser.role,
      action,resource_type:resourceType,resource_id:String(resourceId||""),
      old_data:oldData,new_data:newData
    };
    const { data, error } = await supabaseClient.from("audit_logs").insert(payload).select().single();
    if (!error && data) cache.auditLogs.unshift(camelAudit(data));
  };

  const createStaffUser = async data => {
    const { data: sessionData } = await supabaseClient.auth.getSession();
    const token = sessionData.session?.access_token;
    const response = await fetch(`${SUPABASE_URL}/functions/v1/manage-staff`, {
      method:"POST",
      headers:{"Content-Type":"application/json","Authorization":`Bearer ${token}`},
      body:JSON.stringify({action:"create",payload:data})
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error||"Falha ao criar integrante.");
    const user=camelProfile(result.profile);
    cache.users.push(user);
    return user;
  };

  const updateStaffUser = async (id,patch) => {
    const { data: sessionData } = await supabaseClient.auth.getSession();
    const token = sessionData.session?.access_token;
    const response = await fetch(`${SUPABASE_URL}/functions/v1/manage-staff`, {
      method:"POST",
      headers:{"Content-Type":"application/json","Authorization":`Bearer ${token}`},
      body:JSON.stringify({action:"update",userId:id,payload:patch})
    });
    const result=await response.json();
    if(!response.ok) throw new Error(result.error||"Falha ao atualizar integrante.");
    const user=camelProfile(result.profile);
    const index=cache.users.findIndex(u=>u.id===id);
    if(index>=0)cache.users[index]=user;
    return user;
  };

  const deleteStaffUser = async id => {
    const { data: sessionData } = await supabaseClient.auth.getSession();
    const token = sessionData.session?.access_token;
    const response=await fetch(`${SUPABASE_URL}/functions/v1/manage-staff`,{
      method:"POST",
      headers:{"Content-Type":"application/json","Authorization":`Bearer ${token}`},
      body:JSON.stringify({action:"delete",userId:id})
    });
    const result=await response.json();
    if(!response.ok)return {ok:false,reason:result.error||"failed"};
    cache.users=cache.users.filter(u=>u.id!==id);
    return {ok:true};
  };

  return {
    defaultPermissions,initializePublic,initializeStaff,
    applications,questions,settings,users,announcements,auditLogs,currentUser,
    hasAdminSession,hasPermission,loginStaff,logoutStaff,
    needsInitialSetup,createInitialAdmin,generateProtocol,
    createApplication,findByProtocol,updateApplication,
    saveQuestions,deleteQuestion,saveSettings,
    createAnnouncement,updateAnnouncement,deleteAnnouncement,announcementsForStatus,
    addAudit,createStaffUser,updateStaffUser,deleteStaffUser
  };
})();
