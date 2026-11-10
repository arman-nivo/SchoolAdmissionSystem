using Microsoft.EntityFrameworkCore;
using SchoolAdmission.Api.Domain;

namespace SchoolAdmission.Api.Data;

public class AdmissionDbContext : DbContext
{
    public AdmissionDbContext(DbContextOptions<AdmissionDbContext> options) : base(options) { }

    public DbSet<SchoolClass> Classes => Set<SchoolClass>();
    public DbSet<Hold> Holds => Set<Hold>();

    protected override void OnModelCreating(ModelBuilder model)
    {
        model.Entity<SchoolClass>(e =>
        {
            e.ToTable("classes", t => t.HasCheckConstraint("ck_classes_total_seats_positive", "total_seats > 0"));
            e.HasKey(c => c.Id);
            e.Property(c => c.Id).HasColumnName("id").HasMaxLength(40);
            e.Property(c => c.Name).HasColumnName("name").HasMaxLength(200).IsRequired();
            e.Property(c => c.TotalSeats).HasColumnName("total_seats");
            e.Property(c => c.CreatedAt).HasColumnName("created_at");
            e.HasIndex(c => c.Name).IsUnique();
        });

        model.Entity<Hold>(e =>
        {
            e.ToTable("holds");
            e.HasKey(h => h.Id);
            e.Property(h => h.Id).HasColumnName("id").HasMaxLength(40);
            e.Property(h => h.ClassId).HasColumnName("class_id").HasMaxLength(40);
            e.Property(h => h.StudentId).HasColumnName("student_id").HasMaxLength(17).IsRequired();
            e.Property(h => h.Status)
                .HasColumnName("status")
                .HasMaxLength(20)
                .HasConversion(s => s.ToApi(), s => HoldStatusExtensions.FromApi(s));
            e.Property(h => h.CreatedAt).HasColumnName("created_at");
            e.Property(h => h.ExpiresAt).HasColumnName("expires_at");
            e.Property(h => h.ConfirmedAt).HasColumnName("confirmed_at");
            e.Property(h => h.CancelledAt).HasColumnName("cancelled_at");

            e.HasOne(h => h.Class).WithMany(c => c.Holds).HasForeignKey(h => h.ClassId);

            e.HasIndex(h => new { h.ClassId, h.Status });
            e.HasIndex(h => h.StudentId);
            e.HasIndex(h => new { h.Status, h.ExpiresAt });

            // Safety net in the database itself: one student can have at most one
            // active (HELD or CONFIRMED) application per class.
            e.HasIndex(h => new { h.ClassId, h.StudentId })
                .IsUnique()
                .HasFilter("status IN ('HELD', 'CONFIRMED')")
                .HasDatabaseName("ux_holds_one_active_per_student_per_class");
        });
    }
}
